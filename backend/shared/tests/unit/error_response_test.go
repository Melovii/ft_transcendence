package unit_test

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/melmut-42/ft_transcendence/backend/shared/httpresponse"
)

// TestWriteError checks the public JSON error envelope and fallback response.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - nil, invalid status, missing fields, unencodable details and a valid 422 INVALID_EMAIL
//     error.
//   - Each case specifies the expected HTTP status and public code.
//
// Flow:
//
//  1. Write the error into an HTTP response recorder.
//  2. Decode the envelope and inspect status, code, message, details and Content-Type.
//  3. Check internal values and the status field are not serialized.
//
// Expected output:
//
//   - Invalid definitions return HTTP 500 INTERNAL_ERROR; the public error returns HTTP 422
//     INVALID_EMAIL.
//   - Every response is application/json; charset=utf-8 with a nonempty message and non-null
//     details.
//   - The body contains neither private values nor a serialized Status field.
func TestWriteError(t *testing.T) {
	for _, tt := range []struct {
		name   string
		err    *httpresponse.Error
		status int
		code   string
	}{
		{"default", nil, 500, "INTERNAL_ERROR"},
		{"invalid status", &httpresponse.Error{Status: 200, Code: "private", Message: "private"}, 500, "INTERNAL_ERROR"},
		{"empty definition", &httpresponse.Error{Status: 400}, 500, "INTERNAL_ERROR"},
		{"invalid details", &httpresponse.Error{Status: 400, Code: "private", Message: "private", Details: map[string]any{"value": make(chan int)}}, 500, "INTERNAL_ERROR"},
		{"public", &httpresponse.Error{Status: 422, Code: "INVALID_EMAIL", Message: "Email is invalid.", Details: map[string]any{"field": "email"}}, 422, "INVALID_EMAIL"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			httpresponse.WriteError(response, tt.err)
			var body struct {
				Error httpresponse.Error `json:"error"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || response.Code != tt.status || body.Error.Code != tt.code || body.Error.Details == nil || body.Error.Message == "" {
				t.Fatalf("invalid envelope: %d %s", response.Code, response.Body)
			}
			if response.Header().Get("Content-Type") != "application/json; charset=utf-8" || strings.Contains(response.Body.String(), "private") || strings.Contains(response.Body.String(), `"Status"`) {
				t.Fatalf("unexpected content: %s", response.Body)
			}
		})
	}
}
