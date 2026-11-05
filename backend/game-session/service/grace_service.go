package service

import (
	"time"

	room "game-session/room"
)

func (s *RoomService) MarkDisconnected(roomID int64, userID int64, now time.Time) (room.RoomMember, error) {
	r, members, err := s.store.RoomByID(roomID)
	if err != nil {
		return room.RoomMember{}, err
	}
	member, err := r.MarkDisconnected(room.RoomInput{Members: members}, userID, now)
	if err != nil {
		return room.RoomMember{}, err
	}
	if err := s.store.SaveMember(r, member); err != nil {
		return room.RoomMember{}, err
	}
	return member, nil
}

func (s *RoomService) MarkReconnected(roomID int64, userID int64, now time.Time) (room.RoomMember, error) {
	r, members, err := s.store.RoomByID(roomID)
	if err != nil {
		return room.RoomMember{}, err
	}
	member, err := r.MarkReconnected(room.RoomInput{Members: members}, userID, now)
	if err != nil {
		return room.RoomMember{}, err
	}
	if err := s.store.SaveMember(r, member); err != nil {
		return room.RoomMember{}, err
	}
	return member, nil
}
