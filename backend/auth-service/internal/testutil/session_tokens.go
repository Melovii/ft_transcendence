package testutil

import (
	"context"
	"errors"
	"time"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/model"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

var _ service.SessionTx = (*memoryTx)(nil)

func (t *memoryTx) FindRefreshToken(ctx context.Context, hash string) (model.RefreshToken, model.Session, error) {
	if err := ctx.Err(); err != nil {
		return model.RefreshToken{}, model.Session{}, err
	}
	if t.FailAt == "find_refresh" {
		return model.RefreshToken{}, model.Session{}, errors.New("private refresh lookup error")
	}
	for _, token := range t.Refresh {
		if token.TokenHash != hash {
			continue
		}
		for _, session := range t.Sessions {
			if session.ID == token.SessionID {
				return token, session, nil
			}
		}
	}
	return model.RefreshToken{}, model.Session{}, service.ErrNotFound
}

func (t *memoryTx) RotateRefreshToken(ctx context.Context, id, replacementID string, now time.Time) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if t.FailAt == "rotate" {
		return errors.New("private rotation error")
	}
	for i, token := range t.Refresh {
		if token.ID != id || token.RevokedAt != nil || token.RotatedAt != nil {
			continue
		}
		t.Refresh[i].RotatedAt = &now
		t.Refresh[i].ReplacedBy = &replacementID
		t.Refresh[i].RevokedAt = &now
		return nil
	}
	return service.ErrNotFound
}

func (t *memoryTx) RevokeSession(ctx context.Context, id string, now time.Time) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if t.FailAt == "revoke" {
		return errors.New("private revocation error")
	}
	for i, session := range t.Sessions {
		if session.ID != id {
			continue
		}
		if session.RevokedAt == nil {
			t.Sessions[i].RevokedAt = &now
		}
		t.revokeRefreshTokens(id, now)
		return t.enqueueSessionRevocation(t.Sessions[i])
	}
	return service.ErrNotFound
}

func (t *memoryTx) revokeRefreshTokens(sessionID string, now time.Time) {
	for i, token := range t.Refresh {
		if token.SessionID == sessionID && token.RevokedAt == nil {
			t.Refresh[i].RevokedAt = &now
		}
	}
}
