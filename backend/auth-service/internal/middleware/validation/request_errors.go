package validation

import "errors"

// ErrInvalidRequest identifies a malformed registration request body or content type.
var ErrInvalidRequest = errors.New("request must contain one JSON object with email, username, and password fields")
