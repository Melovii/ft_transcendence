package room

import (
	game "game-session/game"
	"time"
)

func (r *Room) canJoin(currentGame *game.Game) error {
	switch r.Status {
	case StatusWaiting:
		return nil
	case StatusInGame:
		if currentGame == nil {
			return ErrGameNotFound
		}
		if !currentGame.IsPaused() {
			return ErrRoomNotJoinable
		}
		return nil
	case StatusCountDown, StatusPostGame:
		return ErrRoomNotJoinable
	case StatusClosed:
		return ErrRoomNotFound
	default:
		return ErrInvalidRoomState
	}
}

func (r *Room) Join(input RoomInput, userID int64, now time.Time) (RoomMember, error) {
	if err := r.canJoin(input.CurrentGame); err != nil {
		return RoomMember{}, err
	}
	if findMember(input.Members, userID) != nil {
		return RoomMember{}, ErrAlreadyInRoom
	}
	if len(input.Members) >= r.MaxPlayers {
		return RoomMember{}, ErrRoomFull
	}

	state := StateInLobby
	if r.Status == StatusInGame {
		state = StateInGame
	}

	if len(input.Members) == 0 {
		r.HostUserID = copyPtr(&userID)
		r.EmptySince = nil
		r.CloseAt = nil
	}

	return RoomMember{
		RoomID:   r.RoomID,
		UserID:   userID,
		State:    state,
		Team:     nil,
		Role:     nil,
		Ready:    false,
		JoinedAt: now,
	}, nil
}
