package unit_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/controller"
)

// The bruno contract (00 - Contract & Health/health.yml) fixes the response:
// 200 with {"data":{"status":"OK","contract_version":...,"server_time":<ISO 8601 UTC>}}.
func TestHealthMatchesContract(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)

	if err := controller.Health(context); err != nil {
		t.Fatalf("health handler returned error: %v", err)
	}
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}

	var body struct {
		Data struct {
			Status          string `json:"status"`
			ContractVersion string `json:"contract_version"`
			ServerTime      string `json:"server_time"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}

	if body.Data.Status != "OK" {
		t.Errorf("data.status = %q, want %q", body.Data.Status, "OK")
	}
	if body.Data.ContractVersion != controller.ContractVersion {
		t.Errorf("data.contract_version = %q, want %q", body.Data.ContractVersion, controller.ContractVersion)
	}

	rfc3339UTC := regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$`)
	if !rfc3339UTC.MatchString(body.Data.ServerTime) {
		t.Fatalf("data.server_time = %q, want ISO 8601 UTC", body.Data.ServerTime)
	}
	if parsed, err := time.Parse(time.RFC3339, body.Data.ServerTime); err != nil {
		t.Fatalf("data.server_time %q is not parseable RFC3339: %v", body.Data.ServerTime, err)
	} else if parsed.Location() != time.UTC {
		t.Errorf("data.server_time is not UTC: %v", parsed.Location())
	}
}