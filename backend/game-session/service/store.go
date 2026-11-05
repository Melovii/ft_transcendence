package service

import (
	"errors"

	game "game-session/game"
	room "game-session/room"
)

var ErrRoomCodeTaken = errors.New("room code already in use")

type RoomStore interface {
	RoomByCode(code string) (*room.Room, []room.RoomMember, error)
	RoomByID(roomID int64) (*room.Room, []room.RoomMember, error)
	GameOf(roomID int64) (*game.Game, error)
	LastGameOf(roomID int64) (*room.LastGameView, error)
	ActiveRoomOf(userID int64) (int64, bool, error)
	NextGameID() (int64, error)
	WordPool(language string) ([]game.Word, error)

	SaveNewRoom(r *room.Room, host room.RoomMember) error
	SaveJoin(r *room.Room, member room.RoomMember) error
	SaveMember(r *room.Room, member room.RoomMember) error
	// SaveSeatInGame saves the room, member, and game in a single transaction.
	SaveSeatInGame(r *room.Room, member room.RoomMember, g *game.Game) error
	SaveRoom(r *room.Room) error
	SaveLeave(r *room.Room, departedUserID int64, g *game.Game, penalty *room.Penalty) error
	SaveGameStart(r *room.Room, members []room.RoomMember, g *game.Game) error
	SaveGame(g *game.Game) error
	SaveGameEnd(r *room.Room, members []room.RoomMember, lastGame *room.LastGameView) error
	SaveExpiredPostGame(r *room.Room, removedUserIDs []int64) error
}

type ProfileSource interface {
	ProfilesByUserIDs(userIDs []int64) (map[int64]room.Profile, error)
}

type RoomService struct {
	store    RoomStore
	profiles ProfileSource
}

func NewRoomService(store RoomStore, profiles ProfileSource) *RoomService {
	return &RoomService{store: store, profiles: profiles}
}

func (s *RoomService) loadRoom(roomID int64) (*room.Room, []room.RoomMember, *game.Game, error) {
	r, members, err := s.store.RoomByID(roomID)
	if err != nil {
		return nil, nil, nil, err
	}
	currentGame, err := s.store.GameOf(roomID)
	if err != nil {
		return nil, nil, nil, err
	}
	return r, members, currentGame, nil
}

func (s *RoomService) loadDepartedProfile(r *room.Room, members []room.RoomMember, userID int64) (map[int64]room.Profile, error) {
	if r.Status != room.StatusInGame {
		return nil, nil
	}
	for _, member := range members {
		if member.UserID != userID {
			continue
		}
		if member.Team == nil || member.Role == nil {
			return nil, nil
		}
		return s.profiles.ProfilesByUserIDs([]int64{userID})
	}
	return nil, nil
}

func (s *RoomService) loadMemberProfiles(members []room.RoomMember) (map[int64]room.Profile, error) {
	ids := make([]int64, 0, len(members))
	for _, member := range members {
		ids = append(ids, member.UserID)
	}
	return s.profiles.ProfilesByUserIDs(ids)
}
