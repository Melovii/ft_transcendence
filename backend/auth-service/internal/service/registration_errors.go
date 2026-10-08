package service

import "errors"

var (
	ErrInvalidEmail    = errors.New("email must be a valid email address")
	ErrInvalidUsername = errors.New("username must match ^[A-Za-z0-9_]{3,20}$")
	ErrInvalidPassword = errors.New("password must be between 8 and 72 bytes")
	ErrEmailTaken      = errors.New("email is already registered")
	ErrUsernameTaken   = errors.New("username is already registered")
)
