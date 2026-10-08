package service

import (
	"net/mail"
	"regexp"
	"strings"
)

var usernamePattern = regexp.MustCompile(`^[A-Za-z0-9_]{3,20}$`)

// ValidateRegister normalizes and validates registration input.
//
// Parameters:
//
//   - input: Registration fields; email and username are trimmed, while the password is preserved exactly and measured in bytes.
//
// It returns normalized input, or a zero RegisterInput for the first invalid field.
//
// Errors:
//
//   - ErrInvalidEmail: Email format or length is invalid.
//   - ErrInvalidUsername: Username format or length is invalid.
//   - ErrInvalidPassword: Password length is outside 8 to 72 bytes.
func ValidateRegister(input RegisterInput) (RegisterInput, error) {
	input.Email = strings.TrimSpace(input.Email)
	input.Username = strings.TrimSpace(input.Username)

	address, err := mail.ParseAddress(input.Email)
	if err != nil || address.Address != input.Email || len(input.Email) > 254 {
		return RegisterInput{}, ErrInvalidEmail
	}

	if !usernamePattern.MatchString(input.Username) {
		return RegisterInput{}, ErrInvalidUsername
	}

	if len(input.Password) < 8 || len(input.Password) > 72 {
		return RegisterInput{}, ErrInvalidPassword
	}

	return input, nil
}
