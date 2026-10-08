package model

import "time"

// Session represents one login and its refresh-token rotation family.
// Multiple sessions may belong to the same user. Revoking a session must
// invalidate every credential in that family, including access credentials.
// This is an internal persistence model, not an HTTP response.
type Session struct {
	ID        string     `json:"-"`
	UserID    int64      `json:"-"`
	CreatedAt time.Time  `json:"-"`
	RevokedAt *time.Time `json:"-"`
}
