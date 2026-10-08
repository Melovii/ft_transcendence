package unit_test

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/url"
	"reflect"
	"strconv"
	"strings"
	"testing"

	"github.com/melmut-42/ft_transcendence/backend/shared/pagination"
)

// query parses raw query strings for pagination tests.
//
// Parameters:
//
//   - t: Go test runner used to report parse failures.
//   - raw: URL query string without a leading question mark.
//
// Flow:
//
//  1. Mark the function as a test helper and call url.ParseQuery.
//  2. Fail the test if the query cannot be parsed.
//
// Expected output:
//
//   - url.Values containing the decoded query parameters.
func query(t *testing.T, raw string) url.Values {
	t.Helper()
	values, err := url.ParseQuery(raw)
	if err != nil {
		t.Fatal(err)
	}
	return values
}

// TestParseOffset checks valid offset query parsing and endpoint limits.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Missing parameters, limit=5&offset=15, inclusive maxima, offset=MaxInt64 and unrelated q
//     values.
//   - Default limits and friends/search endpoint policies; each case supplies expected limit
//     and offset.
//
// Flow:
//
//  1. Parse each query and pass its endpoint policy to ParseOffset.
//  2. Compare Limit, Offset and FetchLimit with the table expectations.
//
// Expected output:
//
//   - All cases return nil errors; missing values use the configured defaults.
//   - The default request has limit=20 and offset=0; FetchLimit always equals limit+1.
func TestParseOffset(t *testing.T) {
	tests := []struct {
		name   string
		query  string
		limits pagination.Limits
		limit  int
		offset int64
	}{
		{name: "defaults", limit: 20},
		{name: "friends defaults", limits: pagination.Limits{Default: 50, Max: 100}, limit: 50},
		{name: "custom page", query: "limit=5&offset=15", limit: 5, offset: 15},
		{name: "upper limit", query: "limit=100&offset=0", limit: 100},
		{name: "search limit", query: "limit=50", limits: pagination.Limits{Default: 20, Max: 50}, limit: 50},
		{name: "large offset", query: "offset=9223372036854775807", limit: 20, offset: math.MaxInt64},
		{name: "unrelated params", query: "q=hello", limit: 20},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p, err := pagination.ParseOffset(query(t, tt.query), tt.limits)
			if err != nil {
				t.Fatal(err)
			}
			if p.Limit() != tt.limit || p.Offset() != tt.offset || p.FetchLimit() != tt.limit+1 {
				t.Fatalf("got limit=%d offset=%d fetch=%d", p.Limit(), p.Offset(), p.FetchLimit())
			}
		})
	}
}

// TestInvalidOffsetQueries checks invalid offset and limit query values.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Empty, repeated, missing-value, malformed, padded, negative and overflowing values.
//   - Explicit limit=0, default maximum overflow=101 and endpoint maximum overflow=51.
//
// Flow:
//
//  1. Construct url.Values for each invalid parameter.
//  2. Call ParseOffset and assert the validation error names the offending field.
//
// Expected output:
//
//   - Every case returns *ValidationError with Parameter=limit or offset and a nonempty
//     message.
func TestInvalidOffsetQueries(t *testing.T) {
	for _, field := range []string{"limit", "offset"} {
		invalid := []string{"", "-1", "1.5", "hello", " 2", "2 ", "9223372036854775808"}
		if field == "limit" {
			invalid = append(invalid, "0", "101")
		}
		for _, value := range invalid {
			t.Run(field+"="+value, func(t *testing.T) {
				_, err := pagination.ParseOffset(url.Values{field: {value}}, pagination.Limits{})
				assertParameterError(t, err, field)
			})
		}
		for _, values := range [][]string{nil, {}, {"1", "2"}} {
			_, err := pagination.ParseOffset(url.Values{field: values}, pagination.Limits{})
			assertParameterError(t, err, field)
		}
	}
	_, err := pagination.ParseOffset(query(t, "limit=51"), pagination.Limits{Default: 20, Max: 50})
	assertParameterError(t, err, "limit")
}

// assertParameterError checks a pagination validation error and its field.
//
// Parameters:
//
//   - t: Go test runner used to report assertion failures.
//   - err: Error returned by parsing or validation.
//   - field: Expected offending parameter name.
//
// Flow:
//
//  1. Use errors.As to extract *pagination.ValidationError.
//  2. Compare its Parameter with field and require a nonempty error message.
//
// Expected output:
//
//   - No return value; mismatched error type, parameter or message fails the test.
func assertParameterError(t *testing.T, err error, field string) {
	t.Helper()
	var validation *pagination.ValidationError
	if !errors.As(err, &validation) || validation.Parameter != field || validation.Error() == "" {
		t.Fatalf("expected validation error for %s, got %v", field, err)
	}
}

// TestLimits checks invalid policies and the largest safe fetch size.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Negative policies, default above maximum, incompatible default/max values and
//     Max=math.MaxInt.
//   - A valid boundary request with limit=math.MaxInt-1 and the same maximum.
//
// Flow:
//
//  1. Run both offset and reference parsers for each invalid policy.
//  2. Parse the largest safe request and inspect FetchLimit.
//
// Expected output:
//
//   - Invalid policies match ErrInvalidLimits in both parsers.
//   - The boundary request succeeds and FetchLimit=math.MaxInt without overflow.
func TestLimits(t *testing.T) {
	for _, limits := range []pagination.Limits{
		{Default: -1}, {Max: -1}, {Default: 101}, {Max: 10},
		{Default: 5, Max: 4}, {Max: math.MaxInt},
	} {
		if _, err := pagination.ParseOffset(nil, limits); !errors.Is(err, pagination.ErrInvalidLimits) {
			t.Fatalf("offset limits %+v: %v", limits, err)
		}
		if _, err := pagination.ParseRef(nil, "before", limits); !errors.Is(err, pagination.ErrInvalidLimits) {
			t.Fatalf("ref limits %+v: %v", limits, err)
		}
	}
	// Even the largest accepted limit leaves space for a lookahead row.
	p, err := pagination.ParseOffset(query(t, "limit="+strconv.Itoa(math.MaxInt-1)), pagination.Limits{Max: math.MaxInt - 1})
	if err != nil || p.FetchLimit() != math.MaxInt {
		t.Fatalf("fetch limit overflow: %d, %v", p.FetchLimit(), err)
	}
}

// TestParseRef checks reference query names, defaults and validation.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Reference names empty/ref/before/after; opaque, timestamp and maximum-length references.
//   - Missing references; empty, blank, repeated and oversized values; excessive limits;
//     reserved name limit.
//
// Flow:
//
//  1. Parse a first page for each name, then parse valid and invalid references.
//  2. Check the endpoint limit overflow and reserved-name configuration separately.
//
// Expected output:
//
//   - First-page defaults: ref empty, limit=50 and fetch=51; valid supplied references are
//     preserved with limit=5.
//   - Invalid client values identify their reference field or limit in a ValidationError.
//   - An empty name uses ref; reserved name limit returns an error.
func TestParseRef(t *testing.T) {
	for _, name := range []string{"", "ref", "before", "after"} {
		key := name
		if key == "" {
			key = "ref"
		}
		p, err := pagination.ParseRef(nil, name, pagination.Limits{Default: 50})
		if err != nil || p.Ref() != "" || p.Limit() != 50 || p.FetchLimit() != 51 {
			t.Fatalf("first page %q: %+v, %v", name, p, err)
		}
		for _, ref := range []string{"opaque-cursor", "2026-09-10T08:50:00.123456Z", strings.Repeat("a", pagination.MaxRefLength)} {
			p, err := pagination.ParseRef(url.Values{key: {ref}, "limit": {"5"}}, name, pagination.Limits{})
			if err != nil || p.Ref() != ref || p.Limit() != 5 {
				t.Fatalf("reference %q: %+v, %v", name, p, err)
			}
		}
		for _, refs := range [][]string{nil, {""}, {"   "}, {"one", "two"}, {strings.Repeat("a", pagination.MaxRefLength+1)}} {
			_, err := pagination.ParseRef(url.Values{key: refs}, name, pagination.Limits{})
			assertParameterError(t, err, key)
		}
	}
	_, err := pagination.ParseRef(query(t, "limit=51"), "before", pagination.Limits{Default: 20, Max: 50})
	assertParameterError(t, err, "limit")
	if _, err := pagination.ParseRef(nil, "limit", pagination.Limits{}); err == nil {
		t.Fatal("reference parameter must not collide with limit")
	}
}

// TestZeroValueRequests checks zero-value pagination request behavior.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Uninitialized OffsetParams and RefParams structs.
//
// Flow:
//
//  1. Read the limit, fetch limit, offset and reference accessors.
//
// Expected output:
//
//   - Both select limit=20 and fetch=21; offset=0 and ref is empty.
func TestZeroValueRequests(t *testing.T) {
	var offset pagination.OffsetParams
	var ref pagination.RefParams
	if offset.Limit() != 20 || offset.FetchLimit() != 21 || offset.Offset() != 0 ||
		ref.Limit() != 20 || ref.FetchLimit() != 21 || ref.Ref() != "" {
		t.Fatal("zero values must select the default first page")
	}
}

// TestBuildOffsetPage checks offset page contents and exact JSON metadata.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Parsed limit=2&offset=4 with rows nil, [5], [5,6] or [5,6,7].
//
// Flow:
//
//  1. Build each page and embed OffsetMeta next to results.
//  2. Marshal the response and compare it with the case JSON string.
//
// Expected output:
//
//   - limit=2 and offset=4 in every response; nil rows serialize as results=[].
//   - Only [5,6,7] is trimmed and sets has_more=true.
//   - For the lookahead case: {"results":[5,6],"limit":2,"offset":4,"has_more":true}.
func TestBuildOffsetPage(t *testing.T) {
	p, err := pagination.ParseOffset(query(t, "limit=2&offset=4"), pagination.Limits{})
	if err != nil {
		t.Fatal(err)
	}
	for _, tt := range []struct {
		name string
		rows []int
		want string
	}{
		{"empty", nil, `{"results":[],"limit":2,"offset":4,"has_more":false}`},
		{"short", []int{5}, `{"results":[5],"limit":2,"offset":4,"has_more":false}`},
		{"exact", []int{5, 6}, `{"results":[5,6],"limit":2,"offset":4,"has_more":false}`},
		{"next page", []int{5, 6, 7}, `{"results":[5,6],"limit":2,"offset":4,"has_more":true}`},
	} {
		t.Run(tt.name, func(t *testing.T) {
			items, meta := pagination.BuildOffsetPage(p, tt.rows)
			response := struct {
				Results []int `json:"results"`
				pagination.OffsetMeta
			}{items, meta}
			data, err := json.Marshal(response)
			if err != nil || string(data) != tt.want {
				t.Fatalf("response: %s, %v; want %s", data, err, tt.want)
			}
		})
	}
}

// TestBuildRefPage checks reference page trimming and cursor generation.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - limit=2 with terminal rows nil/[1]/[1,2] and lookahead rows [9,8,7].
//   - An ID encoder, a failing encoder, no encoder and blank/oversized encoder results.
//
// Flow:
//
//  1. Build terminal pages and verify the encoder is never called.
//  2. Build a continuing page and encode the last returned row.
//  3. Exercise encoder failures and invalid generated cursor values.
//
// Expected output:
//
//   - Terminal pages return non-nil item slices and {"next_cursor":null}.
//   - Continuing rows return [9,8] and {"next_cursor":"8"}.
//   - Encoder errors are preserved; a missing encoder fails; invalid generated references match
//     ErrInvalidCursor.
func TestBuildRefPage(t *testing.T) {
	p, err := pagination.ParseRef(query(t, "limit=2"), "before", pagination.Limits{})
	if err != nil {
		t.Fatal(err)
	}
	checkTerminalRefPages(t, p)
	items, meta, err := pagination.BuildRefPage(p, []int{9, 8, 7}, func(id int) (string, error) {
		return strconv.Itoa(id), nil
	})
	if err != nil || !reflect.DeepEqual(items, []int{9, 8}) || meta.NextCursor == nil || *meta.NextCursor != "8" {
		t.Fatalf("next page must use the last returned row: %v, %+v, %v", items, meta, err)
	}
	data, err := json.Marshal(meta)
	if err != nil || string(data) != `{"next_cursor":"8"}` {
		t.Fatalf("next metadata: %s, %v", data, err)
	}
	checkRefEncoderFailures(t, p)
}

// TestRefPaginationAcrossPages checks composite cursors across page boundaries.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Descending (time,ID) rows: (3,6), (3,5), (3,4), (2,3), (2,2), (1,1).
//   - limit=2 and a before cursor, initially omitted.
//
// Flow:
//
//  1. Parse each request, decode its cursor and filter rows using the composite ordering.
//  2. Fetch up to limit+1, build the page and append its returned rows.
//  3. Use next_cursor for the next request until the final page.
//
// Expected output:
//
//   - Collected rows equal the full input dataset in order, without skipped or duplicated
//     records.
func TestRefPaginationAcrossPages(t *testing.T) {
	all := []paginationKey{{3, 6}, {3, 5}, {3, 4}, {2, 3}, {2, 2}, {1, 1}}
	var seen []paginationKey
	values := url.Values{"limit": {"2"}}
	for page := 0; page < 4; page++ {
		p, err := pagination.ParseRef(values, "before", pagination.Limits{})
		if err != nil {
			t.Fatal(err)
		}
		rows := filterRefRows(t, p, all)
		items, meta, err := pagination.BuildRefPage(p, rows, func(row paginationKey) (string, error) {
			return pagination.EncodeCursor(row)
		})
		if err != nil {
			t.Fatal(err)
		}
		seen = append(seen, items...)
		if meta.NextCursor == nil {
			break
		}
		values.Set("before", *meta.NextCursor)
	}
	if !reflect.DeepEqual(seen, all) {
		t.Fatalf("records skipped or duplicated: got %v, want %v", seen, all)
	}
}

// TestCursorCodec checks cursor round trips and malformed payload rejection.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - A cursor with ID=MaxInt64, UserID=42 and a timestamp.
//   - nil/unsupported/oversized payloads and malformed base64 or JSON, including partial field
//     assignment and numeric overflow.
//
// Flow:
//
//  1. Encode the valid cursor, check its alphabet and decode it.
//  2. Attempt to encode invalid payloads and decode each malformed reference.
//
// Expected output:
//
//   - The valid cursor round-trips unchanged; its encoded form contains none of +, / or =.
//   - Invalid inputs match ErrInvalidCursor; failed decodes return the zero cursor struct.
func TestCursorCodec(t *testing.T) {
	want := codecCursor{math.MaxInt64, 42, "2026-09-10T08:50:00.123456Z"}
	ref, err := pagination.EncodeCursor(want)
	if err != nil || strings.ContainsAny(ref, "+/=") {
		t.Fatalf("cursor must be unpadded and URL safe: %q, %v", ref, err)
	}
	got, err := pagination.DecodeCursor[codecCursor](ref)
	if err != nil || got != want {
		t.Fatalf("round trip: %+v, %v", got, err)
	}
	for _, value := range []any{nil, (*codecCursor)(nil), func() {}, strings.Repeat("a", pagination.MaxRefLength)} {
		if _, err := pagination.EncodeCursor(value); !errors.Is(err, pagination.ErrInvalidCursor) {
			t.Fatalf("invalid payload %T: %v", value, err)
		}
	}
	checkMalformedCursors(t, ref)
}

// TestValidateLimit checks typed limits independently of HTTP parsing.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Minimum/default/custom maxima and math.MaxInt-1 with valid policies.
//   - Explicit zero, negatives, over-limit values and malformed/overflowing policies.
//
// Flow:
//
//  1. Call ValidateLimit for each typed value and policy.
//  2. Compare the result with success, field-error or configuration-error expectations.
//
// Expected output:
//
//   - Valid values return nil; invalid values produce a ValidationError for limit.
//   - Invalid policies match ErrInvalidLimits, including policies with no lookahead space.
func TestValidateLimit(t *testing.T) {
	tests := limitValidationCases()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := pagination.ValidateLimit(tt.value, tt.limits)
			switch tt.want {
			case "config":
				if !errors.Is(err, pagination.ErrInvalidLimits) {
					t.Fatalf("expected configuration error, got %v", err)
				}
			case "limit":
				assertParameterError(t, err, "limit")
			default:
				if err != nil {
					t.Fatal(err)
				}
			}
		})
	}
}

// TestValidateOffset checks typed offset boundaries.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Offsets 0, 1, MaxInt64, -1 and MinInt64.
//
// Flow:
//
//  1. Validate each nonnegative offset, then assert parameter errors for negative offsets.
//
// Expected output:
//
//   - Nonnegative offsets return nil; negatives return a ValidationError naming offset.
func TestValidateOffset(t *testing.T) {
	for _, offset := range []int64{0, 1, math.MaxInt64} {
		if err := pagination.ValidateOffset(offset); err != nil {
			t.Fatalf("offset %d: %v", offset, err)
		}
	}
	for _, offset := range []int64{-1, math.MinInt64} {
		assertParameterError(t, pagination.ValidateOffset(offset), "offset")
	}
}

// TestValidateRef checks reference names and byte-length boundaries.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Names empty/ref/before/after and the reserved name limit.
//   - Opaque/timestamp references, ASCII and multibyte values at the byte limit, blank and
//     oversized values.
//
// Flow:
//
//  1. Validate supplied references for every supported field name.
//  2. Assert the correct field for invalid values, then test the reserved name separately.
//
// Expected output:
//
//   - Valid values return nil; invalid values identify the selected field, defaulting to ref.
//   - Byte limits apply to multibyte text; name limit returns a configuration error rather than
//     a ValidationError.
func TestValidateRef(t *testing.T) {
	for _, name := range []string{"", "ref", "before", "after"} {
		field := name
		if field == "" {
			field = "ref"
		}
		t.Run(field, func(t *testing.T) {
			for _, ref := range []string{
				"opaque-reference", "2026-09-10T08:50:00Z",
				strings.Repeat("a", pagination.MaxRefLength),
				strings.Repeat("é", pagination.MaxRefLength/2),
			} {
				if err := pagination.ValidateRef(ref, name); err != nil {
					t.Fatalf("valid reference: %v", err)
				}
			}
			for _, ref := range []string{
				"", " \t\n", "\u2003",
				strings.Repeat("a", pagination.MaxRefLength+1),
				strings.Repeat("é", pagination.MaxRefLength/2+1),
			} {
				assertParameterError(t, pagination.ValidateRef(ref, name), field)
			}
		})
	}
	checkReservedRefName(t)
}

// ExampleBuildOffsetPage demonstrates offset parsing and lookahead trimming.
//
// Parameters:
//
//   - None; the Go example runner calls this function without arguments.
//
// Inputs:
//
//   - limit=2, offset=4, policy default=20/max=50 and rows friend-5/friend-6/friend-7.
//
// Flow:
//
//  1. Parse the query, build the page and print fetch size, items and metadata.
//
// Expected output:
//
//   - fetch: 3
//   - items: [friend-5 friend-6]
//   - limit, offset, has_more: 2 4 true
func ExampleBuildOffsetPage() {
	params, err := pagination.ParseOffset(url.Values{
		"limit":  {"2"},
		"offset": {"4"},
	}, pagination.Limits{Default: 20, Max: 50})
	if err != nil {
		panic(err)
	}

	// The repository applies OFFSET 4 and fetches up to FetchLimit() rows
	// in deterministic order. The third row indicates another page exists.
	rows := []string{"friend-5", "friend-6", "friend-7"}
	items, meta := pagination.BuildOffsetPage(params, rows)
	fmt.Println("fetch:", params.FetchLimit())
	fmt.Println("items:", items)
	fmt.Println("limit, offset, has_more:", meta.Limit, meta.Offset, meta.HasMore)
	// Output:
	// fetch: 3
	// items: [friend-5 friend-6]
	// limit, offset, has_more: 2 4 true
}

// ExampleBuildRefPage demonstrates a descending-ID continuation cursor.
//
// Parameters:
//
//   - None; the Go example runner calls this function without arguments.
//
// Inputs:
//
//   - limit=2, reference name before and descending rows [9,8,7].
//
// Flow:
//
//  1. Parse the first-page query and encode the last returned ID as a cursor.
//  2. Print returned items, decode next_cursor and print the next exclusive ID bound.
//
// Expected output:
//
//   - items: [9 8]
//   - next page before ID: 8
func ExampleBuildRefPage() {
	params, err := pagination.ParseRef(url.Values{"limit": {"2"}}, "before", pagination.Limits{})
	if err != nil {
		panic(err)
	}

	type cursor struct {
		ID int64 `json:"id"`
	}
	// This endpoint orders by unique ID descending. The repository has already
	// applied its access checks and fetched up to params.FetchLimit() rows.
	rows := []int64{9, 8, 7}
	items, meta, err := pagination.BuildRefPage(params, rows, func(id int64) (string, error) {
		return pagination.EncodeCursor(cursor{ID: id})
	})
	if err != nil {
		panic(err)
	}

	fmt.Println("items:", items)
	printNextRefID(meta.NextCursor)
	// Output:
	// items: [9 8]
	// next page before ID: 8
}

func checkTerminalRefPages(t *testing.T, p pagination.RefParams) {
	t.Helper()
	for _, rows := range [][]int{nil, {1}, {1, 2}} {
		items, meta, err := pagination.BuildRefPage(p, rows, func(int) (string, error) {
			t.Fatal("encoder must not run on the last page")
			return "", nil
		})
		if err != nil || meta.NextCursor != nil || items == nil || len(items) != len(rows) {
			t.Fatalf("terminal page: %v, %+v, %v", items, meta, err)
		}
		data, err := json.Marshal(meta)
		if err != nil || string(data) != `{"next_cursor":null}` {
			t.Fatalf("terminal metadata: %s, %v", data, err)
		}
	}
}

func checkRefEncoderFailures(t *testing.T, p pagination.RefParams) {
	t.Helper()
	sentinel := errors.New("encode failed")
	_, _, err := pagination.BuildRefPage(p, []int{1, 2, 3}, func(int) (string, error) { return "", sentinel })
	if !errors.Is(err, sentinel) {
		t.Fatalf("lost encoder error: %v", err)
	}
	if _, _, err := pagination.BuildRefPage(p, []int{1, 2, 3}, nil); err == nil {
		t.Fatal("missing encoder must fail when there is a next page")
	}
	for _, value := range []string{"", " ", strings.Repeat("a", pagination.MaxRefLength+1)} {
		_, _, err := pagination.BuildRefPage(p, []int{1, 2, 3}, func(int) (string, error) { return value, nil })
		if !errors.Is(err, pagination.ErrInvalidCursor) {
			t.Fatalf("invalid generated cursor: %v", err)
		}
	}
}

type paginationKey struct {
	Time int64 `json:"time"`
	ID   int64 `json:"id"`
}

func filterRefRows(t *testing.T, p pagination.RefParams, all []paginationKey) []paginationKey {
	t.Helper()
	var cursor paginationKey
	if p.Ref() != "" {
		var err error
		cursor, err = pagination.DecodeCursor[paginationKey](p.Ref())
		if err != nil {
			t.Fatal(err)
		}
	}
	var rows []paginationKey
	for _, row := range all {
		if p.Ref() == "" || row.Time < cursor.Time || (row.Time == cursor.Time && row.ID < cursor.ID) {
			rows = append(rows, row)
			if len(rows) == p.FetchLimit() {
				break
			}
		}
	}
	return rows
}

type codecCursor struct {
	ID     int64  `json:"id"`
	UserID int64  `json:"user_id"`
	Time   string `json:"time"`
}

func checkMalformedCursors(t *testing.T, ref string) {
	t.Helper()
	encodeRaw := base64.RawURLEncoding.EncodeToString
	for _, value := range []string{
		"", "%%%", ref + "=", ref + "\n", strings.Repeat("a", pagination.MaxRefLength+1),
		encodeRaw([]byte("not json")), encodeRaw([]byte("null")), encodeRaw([]byte(" null ")),
		encodeRaw([]byte(`{"id":1} {"id":2}`)), encodeRaw([]byte(`{"id":1,"user_id":"wrong type"}`)),
		encodeRaw([]byte(`{"id":9223372036854775808}`)),
	} {
		got, err := pagination.DecodeCursor[codecCursor](value)
		if !errors.Is(err, pagination.ErrInvalidCursor) || got != (codecCursor{}) {
			t.Fatalf("invalid cursor must return zero value and error: %+v, %v", got, err)
		}
	}
}

type limitValidationCase struct {
	name   string
	value  int
	limits pagination.Limits
	want   string
}

func limitValidationCases() []limitValidationCase {
	return []limitValidationCase{
		{name: "minimum", value: 1},
		{name: "default maximum", value: pagination.MaxLimit},
		{name: "custom maximum", value: 5, limits: pagination.Limits{Default: 2, Max: 5}},
		{name: "largest safe limit", value: math.MaxInt - 1, limits: pagination.Limits{Max: math.MaxInt - 1}},
		{name: "explicit zero", value: 0, want: "limit"},
		{name: "negative", value: -1, want: "limit"},
		{name: "above maximum", value: 51, limits: pagination.Limits{Default: 20, Max: 50}, want: "limit"},
		{name: "invalid default", value: 1, limits: pagination.Limits{Default: -1}, want: "config"},
		{name: "invalid bounds", value: 1, limits: pagination.Limits{Default: 5, Max: 4}, want: "config"},
		{name: "no lookahead space", value: 1, limits: pagination.Limits{Max: math.MaxInt}, want: "config"},
	}
}

func checkReservedRefName(t *testing.T) {
	t.Helper()
	err := pagination.ValidateRef("cursor", "limit")
	var validation *pagination.ValidationError
	if err == nil || errors.As(err, &validation) {
		t.Fatalf("expected a configuration error for the reserved name, got %v", err)
	}
}

func printNextRefID(nextCursor *string) {
	type cursor struct {
		ID int64 `json:"id"`
	}
	if nextCursor != nil {
		// A subsequent request supplies next_cursor as before. The service
		// decodes it, validates the ID, and queries authorized rows with id < ID.
		next, err := pagination.DecodeCursor[cursor](*nextCursor)
		if err != nil {
			panic(err)
		}
		fmt.Println("next page before ID:", next.ID)
	}
}
