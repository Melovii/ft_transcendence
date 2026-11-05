package service

import (
	"time"

	game "game-session/game"
	room "game-session/room"
)

func (s *RoomService) SelectRole(roomID int64, userID int64, team game.Team, role game.Role, now time.Time) (room.SeatResult, error) {
	r, members, currentGame, err := s.loadRoom(roomID)
	if err != nil {
		return room.SeatResult{}, err
	}
	result, err := r.SelectRole(room.RoomInput{Members: members, CurrentGame: currentGame}, userID, team, role, now)
	if err != nil {
		return room.SeatResult{}, err
	}
	if r.Status == room.StatusInGame {
		err = s.store.SaveSeatInGame(r, result.Member, currentGame)
	} else {
		err = s.store.SaveMember(r, result.Member)
	}
	if err != nil {
		return room.SeatResult{}, err
	}
	return result, nil
}

func (s *RoomService) SelectTeam(roomID int64, userID int64, team game.Team, now time.Time) (room.SeatResult, error) {
	r, members, currentGame, err := s.loadRoom(roomID)
	if err != nil {
		return room.SeatResult{}, err
	}
	result, err := r.SelectTeam(room.RoomInput{Members: members, CurrentGame: currentGame}, userID, team, now)
	if err != nil {
		return room.SeatResult{}, err
	}
	if r.Status == room.StatusInGame {
		err = s.store.SaveSeatInGame(r, result.Member, currentGame)
	} else {
		err = s.store.SaveMember(r, result.Member)
	}
	if err != nil {
		return room.SeatResult{}, err
	}
	return result, nil
}

func (s *RoomService) SetReady(roomID int64, userID int64, ready bool, now time.Time) (room.ReadyResult, error) {
	r, members, err := s.store.RoomByID(roomID)
	if err != nil {
		return room.ReadyResult{}, err
	}
	result, err := r.SetReady(room.RoomInput{Members: members}, userID, ready, now)
	if err != nil {
		return room.ReadyResult{}, err
	}
	if err := s.store.SaveMember(r, result.Member); err != nil {
		return room.ReadyResult{}, err
	}
	return result, nil
}

func (s *RoomService) UpdateSettings(roomID int64, userID int64, update room.SettingsUpdate) (room.RoomSettings, error) {
	r, members, err := s.store.RoomByID(roomID)
	if err != nil {
		return room.RoomSettings{}, err
	}
	settings, err := r.UpdateSettings(room.RoomInput{Members: members}, userID, update)
	if err != nil {
		return room.RoomSettings{}, err
	}
	if err := s.store.SaveRoom(r); err != nil {
		return room.RoomSettings{}, err
	}
	return settings, nil
}

func (s *RoomService) Kick(roomID int64, hostUserID int64, targetUserID int64, now time.Time) (room.LeaveResult, error) {
	r, members, currentGame, err := s.loadRoom(roomID)
	if err != nil {
		return room.LeaveResult{}, err
	}
	profiles, err := s.loadDepartedProfile(r, members, targetUserID)
	if err != nil {
		return room.LeaveResult{}, err
	}
	result, err := r.Kick(room.RoomInput{Members: members, CurrentGame: currentGame, Profiles: profiles}, hostUserID, targetUserID, now)
	if err != nil {
		return room.LeaveResult{}, err
	}
	gameToSave := currentGame
	if !result.GamePaused {
		gameToSave = nil
	}
	if err := s.store.SaveLeave(r, targetUserID, gameToSave, nil); err != nil {
		return room.LeaveResult{}, err
	}
	return result, nil
}

func (s *RoomService) ReturnToLobby(roomID int64, userID int64, now time.Time) (room.ReturnResult, error) {
	r, members, err := s.store.RoomByID(roomID)
	if err != nil {
		return room.ReturnResult{}, err
	}
	result, err := r.ReturnToLobby(room.RoomInput{Members: members}, userID, now)
	if err != nil {
		return room.ReturnResult{}, err
	}
	if err := s.store.SaveMember(r, result.Member); err != nil {
		return room.ReturnResult{}, err
	}
	return result, nil
}

func (s *RoomService) StartGame(roomID int64, now time.Time) (*game.Game, error) {
	r, members, err := s.store.RoomByID(roomID)
	if err != nil {
		return nil, err
	}
	wordPool, err := s.store.WordPool(r.Language)
	if err != nil {
		return nil, err
	}
	gameID, err := s.store.NextGameID()
	if err != nil {
		return nil, err
	}
	newGame, inGame, err := r.StartGame(room.RoomInput{Members: members}, wordPool, gameID, now)
	if err != nil {
		return nil, err
	}
	if err := s.store.SaveGameStart(r, inGame, newGame); err != nil {
		return nil, err
	}
	return newGame, nil
}

func (s *RoomService) endGame(r *room.Room, members []room.RoomMember, currentGame *game.Game, now time.Time) (room.GameEndResult, error) {
	result, err := r.HandleGameEnd(room.RoomInput{Members: members, CurrentGame: currentGame}, now)
	if err != nil {
		return room.GameEndResult{}, err
	}
	if err := s.store.SaveGameEnd(r, result.Members, result.LastGame); err != nil {
		return room.GameEndResult{}, err
	}
	return result, nil
}

func (s *RoomService) ExpirePostGame(roomID int64, now time.Time) (room.PostGameTimeoutResult, error) {
	r, members, err := s.store.RoomByID(roomID)
	if err != nil {
		return room.PostGameTimeoutResult{}, err
	}
	result, err := r.ExpirePostGame(room.RoomInput{Members: members}, now)
	if err != nil {
		return room.PostGameTimeoutResult{}, err
	}
	if len(result.RemovedUserIDs) == 0 {
		return result, nil
	}
	if err := s.store.SaveExpiredPostGame(r, result.RemovedUserIDs); err != nil {
		return room.PostGameTimeoutResult{}, err
	}
	return result, nil
}
