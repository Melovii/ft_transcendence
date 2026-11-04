package service

import (
	"errors"
	"time"

	game "backend/Game"
	room "backend/Room"
)

func (s *RoomService) loadGame(roomID int64) (*room.Room, []room.RoomMember, *game.Game, error) {
	r, members, currentGame, err := s.loadRoom(roomID)
	if err != nil {
		return nil, nil, nil, err
	}
	if currentGame == nil {
		return nil, nil, nil, room.ErrGameNotFound
	}
	return r, members, currentGame, nil
}

func (s *RoomService) loadPlayer(members []room.RoomMember, userID int64) (*game.Player, error) {
	for _, member := range members {
		if member.UserID != userID {
			continue
		}
		if member.Team == nil || member.Role == nil {
			return nil, room.ErrRoleRequired
		}
		profiles, err := s.profiles.ProfilesByUserIDs([]int64{userID})
		if err != nil {
			return nil, err
		}
		profile, ok := profiles[userID]
		if !ok {
			return nil, room.ErrMemberProfileNotFound
		}
		return &game.Player{
			UserID:   member.UserID,
			Username: profile.Username,
			Team:     *member.Team,
			Role:     *member.Role,
		}, nil
	}
	return nil, room.ErrNotRoomMember
}

func (s *RoomService) saveMove(r *room.Room, members []room.RoomMember, currentGame *game.Game, now time.Time) error {
	if currentGame.Status() != game.GameStatusInProgress {
		_, err := s.endGame(r, members, currentGame, now)
		return err
	}
	return s.store.SaveGame(currentGame)
}

func (s *RoomService) finishMove(r *room.Room, members []room.RoomMember, currentGame *game.Game, now time.Time, moveErr error) error {
	if errors.Is(moveErr, game.ErrTurnExpired) {
		if err := s.store.SaveGame(currentGame); err != nil {
			return err
		}
	}
	if moveErr != nil {
		return moveErr
	}
	return s.saveMove(r, members, currentGame, now)
}

func (s *RoomService) GiveClue(roomID int64, userID int64, clue game.Clue, now time.Time) (game.CurrentTurn, error) {
	r, members, currentGame, err := s.loadGame(roomID)
	if err != nil {
		return game.CurrentTurn{}, err
	}
	player, err := s.loadPlayer(members, userID)
	if err != nil {
		return game.CurrentTurn{}, err
	}
	turn, err := currentGame.GiveClue(player, &clue, now)
	if err := s.finishMove(r, members, currentGame, now, err); err != nil {
		return game.CurrentTurn{}, err
	}
	return turn, nil
}

func (s *RoomService) GuessCard(roomID int64, userID int64, cardID int, now time.Time) (game.GuessResult, error) {
	r, members, currentGame, err := s.loadGame(roomID)
	if err != nil {
		return game.GuessResult{}, err
	}
	player, err := s.loadPlayer(members, userID)
	if err != nil {
		return game.GuessResult{}, err
	}
	result, err := currentGame.GuessCard(player, cardID, now)
	if err := s.finishMove(r, members, currentGame, now, err); err != nil {
		return game.GuessResult{}, err
	}
	return result, nil
}

func (s *RoomService) PassTurn(roomID int64, userID int64, now time.Time) (game.PassResult, error) {
	r, members, currentGame, err := s.loadGame(roomID)
	if err != nil {
		return game.PassResult{}, err
	}
	player, err := s.loadPlayer(members, userID)
	if err != nil {
		return game.PassResult{}, err
	}
	result, err := currentGame.PassTurn(player, now)
	if err := s.finishMove(r, members, currentGame, now, err); err != nil {
		return game.PassResult{}, err
	}
	return result, nil
}

func (s *RoomService) PassTurnIfExpired(roomID int64, now time.Time) (*game.PassResult, error) {
	_, _, currentGame, err := s.loadGame(roomID)
	if err != nil {
		return nil, err
	}
	result, err := currentGame.PassTurnIfExpired(now)
	if err != nil {
		return nil, err
	}
	if result == nil {
		return nil, nil
	}
	if err := s.store.SaveGame(currentGame); err != nil {
		return nil, err
	}
	return result, nil
}

func (s *RoomService) CancelIfStaffingExpired(roomID int64, now time.Time) (bool, error) {
	r, members, currentGame, err := s.loadGame(roomID)
	if err != nil {
		return false, err
	}
	cancelled, err := currentGame.CancelIfStaffingExpired(now)
	if err != nil {
		return false, err
	}
	if !cancelled {
		return false, nil
	}
	if _, err := s.endGame(r, members, currentGame, now); err != nil {
		return false, err
	}
	return true, nil
}
