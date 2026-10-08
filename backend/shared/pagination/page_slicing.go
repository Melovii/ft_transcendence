// Package pagination provides offset and cursor pagination helpers.
// Repositories own access checks, ordering, and keyset predicates; page builders
// use a lookahead row to produce continuation metadata.
package pagination

func pageLimit(limit int) int {
	if limit == 0 {
		return DefaultLimit
	}
	return limit
}

// trimPage returns up to limit items and whether an extra row exists.
// Requires a positive limit and ordered rows; nil rows become an empty slice.
// Returned items share the input's backing array.
func trimPage[T any](rows []T, limit int) ([]T, bool) {
	if rows == nil {
		return []T{}, false
	}
	if len(rows) > limit {
		return rows[:limit:limit], true
	}
	return rows, false
}
