package model

import "time"

// User is a registered account. Email and username must be unique,
// case-insensitively; password hashing belongs to the service layer.
type User struct {
	ID           int64     `json:"user_id"`
	Email        string    `json:"email"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"-"`
}
