package unit_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/melmut-42/ft_transcendence/backend/user-service/internal/router"
)

// TestValidationError checks the VALIDATION_ERROR response written through the router.
//
// Parameters:
//
//   - t: Go test runner used for subtests and assertions.
//
// Expected output:
//
//   - HTTP 400 in the common error envelope with code VALIDATION_ERROR; the given
//     fields appear under details.fields, and details is an empty object without them.
func TestValidationError(t *testing.T) {
	tests := []struct {
		name       string
		fields     map[string]string
		wantFields bool
	}{
		{"with fields", map[string]string{"username": "must be 3 to 20 characters"}, true},
		{"without fields", nil, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			engine := gin.New()
			engine.GET("/x", router.Wrap(func(*gin.Context) error {
				return router.ValidationError(tt.fields)
			}, nil))

			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/x", nil))

			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", recorder.Code)
			}
			errBody, _ := decode(t, recorder)["error"].(map[string]any)
			if errBody["code"] != "VALIDATION_ERROR" {
				t.Fatalf("code = %v, want VALIDATION_ERROR", errBody["code"])
			}
			details, _ := errBody["details"].(map[string]any)
			if details == nil {
				t.Fatal("details is not an object")
			}
			fields, hasFields := details["fields"].(map[string]any)
			if hasFields != tt.wantFields {
				t.Fatalf("details.fields present = %v, want %v", hasFields, tt.wantFields)
			}
			if tt.wantFields && fields["username"] != "must be 3 to 20 characters" {
				t.Fatalf("details.fields = %v", fields)
			}
		})
	}
}
