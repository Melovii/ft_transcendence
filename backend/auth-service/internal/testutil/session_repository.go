package testutil

import (
	"context"
	"errors"
	"maps"
	"strings"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/model"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

var _ service.SessionRepository = (*MemoryRepository)(nil)

func (r *MemoryRepository) draft() *memoryTx {
	return &memoryTx{state: state{
		Users:                append([]model.User(nil), r.Users...),
		Sessions:             append([]model.Session(nil), r.Sessions...),
		Refresh:              append([]model.RefreshToken(nil), r.Refresh...),
		Revocations:          append([]service.SessionRevocation(nil), r.Revocations...),
		DeliveredRevocations: maps.Clone(r.DeliveredRevocations),
	}, FailAt: r.FailAt}
}

// FindUserByEmail matches the database's case-insensitive email lookup.
func (r *MemoryRepository) FindUserByEmail(ctx context.Context, email string) (model.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return model.User{}, err
	}
	if r.FailAt == "find_user" {
		return model.User{}, errors.New("private user lookup error")
	}
	for _, user := range r.Users {
		if strings.EqualFold(user.Email, email) {
			return user, nil
		}
	}
	return model.User{}, service.ErrNotFound
}

func (r *MemoryRepository) FindSessionUser(ctx context.Context, id string) (model.User, model.Session, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return model.User{}, model.Session{}, err
	}
	if r.FailAt == "find_session" {
		return model.User{}, model.Session{}, errors.New("private session lookup error")
	}
	for _, session := range r.Sessions {
		if session.ID != id {
			continue
		}
		for _, user := range r.Users {
			if user.ID == session.UserID {
				return user, session, nil
			}
		}
	}
	return model.User{}, model.Session{}, service.ErrNotFound
}

// WithSessionTransaction serializes draft changes and publishes only on commit.
func (r *MemoryRepository) WithSessionTransaction(ctx context.Context, fn func(service.SessionTx) error) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return err
	}
	r.Calls++
	draft := r.draft()
	if err := fn(draft); err != nil {
		return err
	}
	if r.CommitErr != nil {
		return r.CommitErr
	}
	r.state = draft.state
	return nil
}
