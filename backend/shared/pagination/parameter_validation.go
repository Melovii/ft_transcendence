package pagination

import (
	"errors"
	"fmt"
	"strings"
)

// ValidateLimit returns nil for an explicit page size within the endpoint's bounds.
// Zero is invalid; defaults apply to Limits fields, not to the supplied value.
// Failure returns [ErrInvalidLimits] or a [ValidationError] for "limit".
func ValidateLimit(limit int, limits Limits) error {
	limits, err := limits.normalized()
	if err != nil {
		return err
	}
	if limit < 1 || limit > limits.Max {
		return invalidLimit(limits.Max)
	}
	return nil
}

// ValidateOffset returns nil for a non-negative row offset, including zero.
// Negative values return a [ValidationError] for "offset".
func ValidateOffset(offset int64) error {
	if offset < 0 {
		return invalidOffset()
	}
	return nil
}

// ValidateRef returns nil for a non-blank reference within [MaxRefLength] bytes.
// It validates a supplied value; an omitted first-page reference is handled by
// the caller. Failures return a [ValidationError] under name (default "ref"),
// or a configuration error for name "limit". Cursor contents are not decoded.
func ValidateRef(ref, name string) error {
	name, err := referenceParameter(name)
	if err != nil {
		return err
	}
	if !validRef(ref) {
		return &ValidationError{
			Parameter: name,
			Message:   fmt.Sprintf("must be non-blank and at most %d bytes", MaxRefLength),
		}
	}
	return nil
}

// referenceParameter defaults an empty name to "ref" and rejects a limit collision.
func referenceParameter(name string) (string, error) {
	if name == "" {
		return "ref", nil
	}
	if name == "limit" {
		return "", errors.New("pagination: reference parameter cannot be limit")
	}
	return name, nil
}

func validRef(ref string) bool {
	return len(ref) <= MaxRefLength && strings.TrimSpace(ref) != ""
}

func invalidLimit(max int) *ValidationError {
	return &ValidationError{
		Parameter: "limit",
		Message:   fmt.Sprintf("must be an integer between 1 and %d", max),
	}
}

func invalidOffset() *ValidationError {
	return &ValidationError{
		Parameter: "offset",
		Message:   "must be a non-negative 64-bit integer",
	}
}
