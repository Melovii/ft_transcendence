package pagination

import (
	"errors"
	"fmt"
	"net/url"
)

// RefParams holds a validated page size and a raw reference.
// Its zero value selects the first page with [DefaultLimit] rows.
// Use [ParseRef] for other requests; reference semantics belong to the service.
type RefParams struct {
	limit int
	ref   string
}

// Limit returns the response page size, excluding the lookahead row.
// A zero-value request uses [DefaultLimit].
func (p RefParams) Limit() int { return pageLimit(p.limit) }

// Ref returns the raw reference; an empty value selects the first page.
func (p RefParams) Ref() string { return p.ref }

// FetchLimit returns Limit plus one so [BuildRefPage] can detect another page.
func (p RefParams) FetchLimit() int { return p.Limit() + 1 }

// ParseRef parses and validates reference pagination parameters.
//
// Parameters:
//
//   - query: Limit and reference query values; nil is treated as empty.
//   - name: Reference parameter name, defaulting to "ref"; "before" and "after" do not define ordering.
//   - limits: Page-size defaults and bounds.
//
// It returns a validated limit and raw reference; an omitted reference selects
// the first page. The service must decode it and validate ordering keys and scope.
// On failure, it returns zero parameters.
//
// Errors:
//
//   - [ErrInvalidLimits]: The configured page-size bounds are invalid.
//   - Configuration error: name is "limit", which conflicts with the page-size parameter.
//   - [ValidationError]: Query values are invalid; a supplied reference must occur once, be non-blank and fit [MaxRefLength].
func ParseRef(query url.Values, name string, limits Limits) (RefParams, error) {
	name, err := referenceParameter(name)
	if err != nil {
		return RefParams{}, err
	}
	limit, err := parseLimit(query, limits)
	if err != nil {
		return RefParams{}, err
	}
	ref, err := parseReference(query, name)
	if err != nil {
		return RefParams{}, err
	}
	return RefParams{limit: limit, ref: ref}, nil
}

// RefMeta contains the continuation cursor for a reference-paginated response.
// Embed it alongside the endpoint's items.
type RefMeta struct {
	// NextCursor is nil on the final page and encodes as JSON null.
	// Otherwise, clients send its value as the next request's reference.
	NextCursor *string `json:"next_cursor"`
}

// BuildRefPage trims a reference page and builds continuation metadata.
//
// Parameters:
//
//   - p: Validated page-size and reference parameters.
//   - rows: Authorized, deterministically ordered rows fetched with p.FetchLimit() and a strict keyset predicate when a reference is present.
//   - encode: Callback producing a cursor from the last returned item when another page exists.
//
// It returns up to p.Limit() items and metadata. With an extra row, encode runs
// once on the last returned item; otherwise NextCursor is nil and encode is unused.
// Nil rows become an empty slice; returned items share rows' backing array.
// On failure, it returns nil items and zero metadata.
//
// Errors:
//
//   - Missing encoder: Another page exists but encode is nil.
//   - [ErrInvalidCursor]: The encoded cursor is blank or exceeds [MaxRefLength].
//   - Encoder errors: encode failed; its error is wrapped.
func BuildRefPage[T any](p RefParams, rows []T, encode func(T) (string, error)) ([]T, RefMeta, error) {
	items, hasMore := trimPage(rows, p.Limit())
	if !hasMore {
		return items, RefMeta{}, nil
	}
	cursor, err := encodeNextCursor(items[len(items)-1], encode)
	if err != nil {
		return nil, RefMeta{}, err
	}
	return items, RefMeta{NextCursor: cursor}, nil
}

// encodeNextCursor returns a validated reference pointer or nil with an error.
// Encoder errors are wrapped; blank or oversized results return ErrInvalidCursor.
func encodeNextCursor[T any](last T, encode func(T) (string, error)) (*string, error) {
	if encode == nil {
		return nil, errors.New("pagination: cursor encoder is required for the next page")
	}
	ref, err := encode(last)
	if err != nil {
		return nil, fmt.Errorf("pagination: encode next cursor: %w", err)
	}
	if !validRef(ref) {
		return nil, ErrInvalidCursor
	}
	return &ref, nil
}
