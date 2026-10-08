package pagination

import "net/url"

// OffsetParams holds a validated offset pagination request.
// Its zero value selects offset zero and [DefaultLimit] rows. Use [ParseOffset]
// to construct other requests; accessors expose the values needed by a repository.
type OffsetParams struct {
	limit  int
	offset int64
}

// Limit returns the response page size, excluding the lookahead row.
// A zero-value request uses [DefaultLimit].
func (p OffsetParams) Limit() int { return pageLimit(p.limit) }

// Offset returns the number of ordered rows to skip.
func (p OffsetParams) Offset() int64 { return p.offset }

// FetchLimit returns Limit plus one so [BuildOffsetPage] can detect another page.
func (p OffsetParams) FetchLimit() int { return p.Limit() + 1 }

// ParseOffset parses and validates offset pagination parameters.
//
// Parameters:
//
//   - query: Limit and offset query values; nil is treated as empty and unrelated keys are ignored.
//   - limits: Page-size defaults and bounds; zero fields use package defaults.
//
// It returns validated parameters; omitted values use the effective default
// limit and offset zero. On failure, it returns zero parameters.
//
// Errors:
//
//   - [ErrInvalidLimits]: The configured page-size bounds are invalid.
//   - [ValidationError]: A limit or offset is empty, repeated, malformed or out of range; offset must fit in a non-negative int64.
func ParseOffset(query url.Values, limits Limits) (OffsetParams, error) {
	limit, err := parseLimit(query, limits)
	if err != nil {
		return OffsetParams{}, err
	}
	offset, err := parseOffsetValue(query)
	if err != nil {
		return OffsetParams{}, err
	}
	return OffsetParams{limit: limit, offset: offset}, nil
}

// OffsetMeta contains the applied pagination values and continuation indicator.
// Embed it in an endpoint response alongside its items and any separate total.
type OffsetMeta struct {
	// Limit is the requested page size, excluding the lookahead row.
	Limit int `json:"limit"`

	// Offset is the number of rows skipped before the returned items.
	Offset int64 `json:"offset"`

	// HasMore reports whether the repository returned an extra row.
	HasMore bool `json:"has_more"`
}

// BuildOffsetPage returns up to p.Limit() items and metadata containing the
// applied Limit, Offset, and HasMore. Fetch p.FetchLimit() ordered rows after
// applying p.Offset(); HasMore is true only when an extra row exists.
//
// Nil rows become an empty slice. Returned items share rows' backing array.
func BuildOffsetPage[T any](p OffsetParams, rows []T) ([]T, OffsetMeta) {
	items, hasMore := trimPage(rows, p.Limit())
	return items, OffsetMeta{Limit: p.Limit(), Offset: p.Offset(), HasMore: hasMore}
}
