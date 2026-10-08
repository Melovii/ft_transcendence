package pagination

import "errors"

var (
	// ErrInvalidLimits indicates an invalid endpoint configuration, rather than
	// a bad client parameter. Callers can identify it with errors.Is.
	ErrInvalidLimits = errors.New("pagination: invalid limits")

	// ErrInvalidCursor identifies cursor encoding or decoding failures and
	// invalid references produced by BuildRefPage's encoder. Wrapped codec
	// errors remain identifiable with errors.Is(err, ErrInvalidCursor).
	ErrInvalidCursor = errors.New("pagination: invalid cursor")
)

// ValidationError describes an invalid pagination input.
// Use errors.As to inspect it and map it to the endpoint's validation response.
// Configuration and encoder failures are not query validation errors.
type ValidationError struct {
	// Parameter is the offending field or query key, such as limit or before.
	Parameter string

	// Message explains the failed constraint without echoing the supplied value.
	Message string
}

// Error returns the parameter name and failed constraint.
func (e *ValidationError) Error() string {
	return "pagination: " + e.Parameter + " " + e.Message
}
