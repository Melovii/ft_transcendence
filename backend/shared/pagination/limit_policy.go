package pagination

import "math"

const (
	// DefaultLimit is the page size used when Limits.Default is zero.
	DefaultLimit = 20

	// MaxLimit is the upper bound used when Limits.Max is zero.
	// An endpoint can select a different bound through Limits.Max.
	MaxLimit = 100

	// MaxRefLength is the maximum byte length of a raw reference or encoded cursor.
	MaxRefLength = 4096
)

// Limits configures the default and maximum page sizes for an endpoint.
// Its zero value uses [DefaultLimit] and [MaxLimit]. Parsers reject invalid
// settings with [ErrInvalidLimits] before reading client parameters.
type Limits struct {
	// Default is the limit used when the query omits limit. Zero uses DefaultLimit.
	Default int

	// Max is the largest accepted limit. Zero uses MaxLimit. After defaults are
	// applied, Max must be at least Default and less than the maximum int value
	// to leave room for a lookahead row. Both values must be positive.
	Max int
}

// normalized returns a copy with defaults applied, or
// (Limits{}, ErrInvalidLimits) if the page size cannot include a lookahead row
// or the configured bounds are invalid.
func (l Limits) normalized() (Limits, error) {
	if l.Default == 0 {
		l.Default = DefaultLimit
	}
	if l.Max == 0 {
		l.Max = MaxLimit
	}
	if l.Default < 1 || l.Max < l.Default || l.Max >= math.MaxInt {
		return Limits{}, ErrInvalidLimits
	}
	return l, nil
}
