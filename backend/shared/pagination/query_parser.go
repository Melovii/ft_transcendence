package pagination

import (
	"net/url"
	"strconv"
)

// parameter returns the raw value, key presence, and a validation error.
// An omitted key returns ("", false, nil); an invalid value returns
// ("", true, *ValidationError). Presence alone does not imply validity.
func parameter(query url.Values, name string) (string, bool, error) {
	values, present := query[name]
	if !present {
		return "", false, nil
	}
	if len(values) != 1 || values[0] == "" {
		return "", true, &ValidationError{
			Parameter: name,
			Message:   "must have exactly one non-empty value",
		}
	}
	return values[0], true, nil
}

// parseLimit returns the configured default or validated query limit.
// On failure, returns zero with ErrInvalidLimits or *ValidationError.
func parseLimit(query url.Values, limits Limits) (int, error) {
	limits, err := limits.normalized()
	if err != nil {
		return 0, err
	}
	raw, present, err := parameter(query, "limit")
	if err != nil {
		return 0, err
	}
	if !present {
		return limits.Default, nil
	}
	limit, err := strconv.Atoi(raw)
	if err != nil {
		return 0, invalidLimit(limits.Max)
	}
	if err := ValidateLimit(limit, limits); err != nil {
		return 0, err
	}
	return limit, nil
}

// parseOffsetValue returns the offset, defaulting to zero when omitted.
// Invalid input returns (0, *ValidationError).
func parseOffsetValue(query url.Values) (int64, error) {
	raw, present, err := parameter(query, "offset")
	if err != nil || !present {
		return 0, err
	}
	offset, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0, invalidOffset()
	}
	if err := ValidateOffset(offset); err != nil {
		return 0, err
	}
	return offset, nil
}

// parseReference returns the raw reference, or ("", nil) when omitted.
// Invalid input returns ("", *ValidationError); cursor contents are not decoded.
func parseReference(query url.Values, name string) (string, error) {
	ref, present, err := parameter(query, name)
	if err != nil || !present {
		return "", err
	}
	if err := ValidateRef(ref, name); err != nil {
		return "", err
	}
	return ref, nil
}
