package model

import "time"

// RefreshToken stores metadata for an opaque refresh credential.
// Store only the token hash, never the raw cookie value. Retain rotated
// records until their expiry so reuse can revoke the associated session.
type RefreshToken struct {
	ID        string    `json:"-"`
	SessionID string    `json:"-"`
	TokenHash string    `json:"-"`
	CreatedAt time.Time `json:"-"`
	ExpiresAt time.Time `json:"-"`

	// Rotation consumes the old token and links it to its replacement.
	// RevokedAt also covers revocation without a replacement (such as logout).
	RotatedAt  *time.Time `json:"-"`
	ReplacedBy *string    `json:"-"`
	RevokedAt  *time.Time `json:"-"`
}
