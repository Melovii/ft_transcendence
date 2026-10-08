package pagination

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
)

// EncodeCursor returns non-null JSON encoded as unpadded URL-safe base64.
// The result must fit [MaxRefLength]. Failure returns an empty string and an
// error matching [ErrInvalidCursor]; JSON errors are also wrapped.
//
// Include all ordering keys and a unique tie-breaker. Encoding does not sign or
// encrypt the payload; the service must validate scope and enforce access checks.
func EncodeCursor(value any) (string, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return "", fmt.Errorf("%w: %w", ErrInvalidCursor, err)
	}
	if isNullJSON(data) {
		return "", ErrInvalidCursor
	}
	encoded := base64.RawURLEncoding.EncodeToString(data)
	if len(encoded) > MaxRefLength {
		return "", ErrInvalidCursor
	}

	return encoded, nil
}

// DecodeCursor returns the JSON value of T from a canonical, unpadded URL-safe
// base64 cursor. Empty, oversized, malformed, or JSON-null inputs are rejected.
// Failure returns T's zero value and an error matching [ErrInvalidCursor],
// including wrapped JSON errors; partially decoded values are never returned.
//
// The service must validate required fields, ordering keys, and scope.
// Plain timestamp references should be parsed directly instead.
func DecodeCursor[T any](ref string) (T, error) {
	var zero T
	data, err := decodeCursorPayload(ref)
	if err != nil {
		return zero, err
	}
	var value T
	if err := json.Unmarshal(data, &value); err != nil {
		return zero, fmt.Errorf("%w: %w", ErrInvalidCursor, err)
	}
	return value, nil
}

// decodeCursorPayload returns decoded bytes or (nil, ErrInvalidCursor).
// It validates the base64 envelope and rejects JSON null; JSON syntax and type
// compatibility are checked later by DecodeCursor.
func decodeCursorPayload(ref string) ([]byte, error) {
	if ref == "" || len(ref) > MaxRefLength {
		return nil, ErrInvalidCursor
	}
	data, err := base64.RawURLEncoding.Strict().DecodeString(ref)
	if err != nil {
		return nil, ErrInvalidCursor
	}
	// The round trip rejects non-canonical text, including embedded line breaks.
	if base64.RawURLEncoding.EncodeToString(data) != ref || isNullJSON(data) {
		return nil, ErrInvalidCursor
	}
	return data, nil
}

func isNullJSON(data []byte) bool {
	return bytes.Equal(bytes.TrimSpace(data), []byte("null"))
}
