package postgres

import (
	"context"
	"time"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/model"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

// FindRefreshToken locks the family first, then rereads and locks its token.
// This ordering serializes rotation, reuse detection and logout without deadlocks.
func (t *authTx) FindRefreshToken(ctx context.Context, hash string) (model.RefreshToken, model.Session, error) {
	var sessionID string
	err := t.tx.QueryRow(ctx, `SELECT session_id::text FROM refresh_tokens WHERE token_hash = $1`, hash).
		Scan(&sessionID)
	if err != nil {
		return model.RefreshToken{}, model.Session{}, sessionError(err)
	}
	session, err := t.lockSession(ctx, sessionID)
	if err != nil {
		return model.RefreshToken{}, model.Session{}, err
	}
	token, err := t.lockRefreshToken(ctx, hash)
	if err != nil {
		return model.RefreshToken{}, model.Session{}, err
	}
	return token, session, nil
}

func (t *authTx) lockSession(ctx context.Context, id string) (model.Session, error) {
	var session model.Session
	err := t.tx.QueryRow(ctx, `
		SELECT id::text, user_id, created_at, revoked_at
		FROM sessions WHERE id = $1 FOR UPDATE`, id).
		Scan(&session.ID, &session.UserID, &session.CreatedAt, &session.RevokedAt)
	if err != nil {
		return model.Session{}, sessionError(err)
	}
	normalizeSession(&session)
	return session, nil
}

func (t *authTx) lockRefreshToken(ctx context.Context, hash string) (model.RefreshToken, error) {
	var token model.RefreshToken
	err := t.tx.QueryRow(ctx, `
		SELECT id::text, session_id::text, token_hash, created_at, expires_at,
		       rotated_at, replaced_by::text, revoked_at
		FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`, hash).Scan(
		&token.ID, &token.SessionID, &token.TokenHash, &token.CreatedAt,
		&token.ExpiresAt, &token.RotatedAt, &token.ReplacedBy, &token.RevokedAt)
	if err != nil {
		return model.RefreshToken{}, sessionError(err)
	}
	normalizeRefreshToken(&token)
	return token, nil
}

func normalizeRefreshToken(token *model.RefreshToken) {
	token.CreatedAt, token.ExpiresAt = token.CreatedAt.UTC(), token.ExpiresAt.UTC()
	if token.RotatedAt != nil {
		value := token.RotatedAt.UTC()
		token.RotatedAt = &value
	}
	if token.RevokedAt != nil {
		value := token.RevokedAt.UTC()
		token.RevokedAt = &value
	}
}

// RotateRefreshToken consumes a locked token after its replacement was inserted.
func (t *authTx) RotateRefreshToken(ctx context.Context, id, replacementID string, now time.Time) error {
	result, err := t.tx.Exec(ctx, `
		UPDATE refresh_tokens SET rotated_at = $3, replaced_by = $2, revoked_at = $3
		WHERE id = $1 AND rotated_at IS NULL AND revoked_at IS NULL`, id, replacementID, now)
	if err != nil {
		return err
	}
	if result.RowsAffected() != 1 {
		return service.ErrNotFound
	}
	return nil
}

// RevokeSession locks the family and preserves any earlier revocation timestamp.
func (t *authTx) RevokeSession(ctx context.Context, id string, now time.Time) error {
	result, err := t.tx.Exec(ctx, `
		UPDATE sessions SET revoked_at = COALESCE(revoked_at, $2) WHERE id = $1`, id, now)
	if err != nil {
		return err
	}
	if result.RowsAffected() != 1 {
		return service.ErrNotFound
	}
	_, err = t.tx.Exec(ctx, `
		UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, $2)
		WHERE session_id = $1`, id, now)
	if err != nil {
		return err
	}
	return t.enqueueSessionRevocation(ctx, id)
}
