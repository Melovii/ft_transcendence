package service

import (
	"crypto/rand"
	"errors"
	"strings"
	"time"

	room "game-session/room"
)

func newRoomCode() (string, error) {
	alphabet := "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	code := make([]byte, 6)

	if _, err := rand.Read(code); err != nil {
		return "", err
	}
	for i, value := range code {
		code[i] = alphabet[int(value)%len(alphabet)]
	}
	return string(code), nil
}

func (s *RoomService) snapshot(r *room.Room, members []room.RoomMember, input room.RoomInput, userID int64, now time.Time) (room.RoomSnapshot, error) {
	profiles, err := s.loadMemberProfiles(members)
	if err != nil {
		return room.RoomSnapshot{}, err
	}
	input.Members = members
	input.Profiles = profiles
	input.Countdown = r.Countdown(now)
	return r.SnapshotForRoom(input, userID)
}

func (s *RoomService) validateRoomCreation(userID int64, maxPlayers *int) (int, error) {
	capacity := 20
	if maxPlayers != nil {
		capacity = *maxPlayers
	}
	if capacity < 4 || capacity > 20 {
		return 0, room.ErrInvalidPayload
	}

	_, hasActiveRoom, err := s.store.ActiveRoomOf(userID)
	if err != nil {
		return 0, err
	}
	if hasActiveRoom {
		return 0, room.ErrAlreadyInRoom
	}

	return capacity, nil
}

func (s *RoomService) saveRoomWithUniqueCode(r *room.Room, host room.RoomMember) error {
	for attempt := 0; attempt < 5; attempt++ {
		code, err := newRoomCode()
		if err != nil {
			return err
		}
		r.RoomCode = code

		err = s.store.SaveNewRoom(r, host)
		if errors.Is(err, ErrRoomCodeTaken) {
			continue
		}
		return err
	}

	return ErrRoomCodeTaken
}

func (s *RoomService) Create(userID int64, maxPlayers *int, now time.Time) (room.RoomSnapshot, error) {
	capacity, err := s.validateRoomCreation(userID, maxPlayers)
	if err != nil {
		return room.RoomSnapshot{}, err
	}

	r := &room.Room{
		Status:     room.StatusWaiting,
		MaxPlayers: capacity,
		Language:   "en",
		CreatedAt:  now,
	}
	host, err := r.Join(room.RoomInput{}, userID, now)
	if err != nil {
		return room.RoomSnapshot{}, err
	}
	if err := s.saveRoomWithUniqueCode(r, host); err != nil {
		return room.RoomSnapshot{}, err
	}

	host.RoomID = r.RoomID
	return s.snapshot(r, []room.RoomMember{host}, room.RoomInput{}, userID, now)
}

type RoomSummary struct {
	RoomID      int64
	RoomCode    string
	Status      room.Status
	PlayerCount int
	MaxPlayers  int
}

func (s *RoomService) FindRoomByCode(code string) (RoomSummary, error) {
	r, members, err := s.store.RoomByCode(strings.ToUpper(code))
	if err != nil {
		return RoomSummary{}, err
	}
	return RoomSummary{
		RoomID:      r.RoomID,
		RoomCode:    r.RoomCode,
		Status:      r.Status,
		PlayerCount: len(members),
		MaxPlayers:  r.MaxPlayers,
	}, nil
}

func (s *RoomService) Join(roomID int64, userID int64, now time.Time) (room.RoomSnapshot, error) {
	r, members, currentGame, err := s.loadRoom(roomID)
	if err != nil {
		return room.RoomSnapshot{}, err
	}
	_, hasActiveRoom, err := s.store.ActiveRoomOf(userID)
	if err != nil {
		return room.RoomSnapshot{}, err
	}
	if hasActiveRoom {
		return room.RoomSnapshot{}, room.ErrAlreadyInRoom
	}

	member, err := r.Join(room.RoomInput{Members: members, CurrentGame: currentGame}, userID, now)
	if err != nil {
		return room.RoomSnapshot{}, err
	}

	if err := s.store.SaveJoin(r, member); err != nil {
		return room.RoomSnapshot{}, err
	}

	members = append(members, member)
	return s.snapshot(r, members, room.RoomInput{CurrentGame: currentGame}, userID, now)
}

func (s *RoomService) Snapshot(roomID int64, userID int64, now time.Time) (room.RoomSnapshot, error) {
	r, members, currentGame, err := s.loadRoom(roomID)
	if err != nil {
		return room.RoomSnapshot{}, err
	}
	lastGame, err := s.store.LastGameOf(roomID)
	if err != nil {
		return room.RoomSnapshot{}, err
	}
	return s.snapshot(r, members, room.RoomInput{CurrentGame: currentGame, LastGame: lastGame}, userID, now)
}

func (s *RoomService) Leave(roomID int64, userID int64, reason room.DepartureReason, now time.Time) (room.LeaveResult, error) {
	r, members, currentGame, err := s.loadRoom(roomID)
	if err != nil {
		return room.LeaveResult{}, err
	}
	profiles, err := s.loadDepartedProfile(r, members, userID)
	if err != nil {
		return room.LeaveResult{}, err
	}

	result, err := r.Leave(room.RoomInput{Members: members, CurrentGame: currentGame, Profiles: profiles}, userID, reason, now)
	if err != nil {
		return room.LeaveResult{}, err
	}

	gameToSave := currentGame
	if !result.GamePaused {
		gameToSave = nil
	}
	if err := s.store.SaveLeave(r, userID, gameToSave, result.Penalty); err != nil {
		return room.LeaveResult{}, err
	}
	return result, nil
}
