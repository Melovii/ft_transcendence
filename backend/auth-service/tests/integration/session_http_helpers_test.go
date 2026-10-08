package integration_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/testutil"
)

func requestAuth(handler http.Handler, method, path, body string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, "/api/v1/auth"+path, strings.NewReader(body))
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func registerForSession(t *testing.T, handler http.Handler) map[string]*http.Cookie {
	t.Helper()
	response := requestRegister(handler, inputJSON(t, testutil.ValidInput()), "application/json")
	if response.Code != http.StatusCreated {
		t.Fatalf("registration failed: %d %s", response.Code, response.Body)
	}
	return credentialCookies(t, response)
}

func credentialCookies(t *testing.T, response *httptest.ResponseRecorder) map[string]*http.Cookie {
	t.Helper()
	checkNoStore(t, response)
	cookies := make(map[string]*http.Cookie)
	for _, cookie := range response.Result().Cookies() {
		if !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteLaxMode || !cookie.Expires.After(time.Now()) {
			t.Fatalf("invalid credential cookie: %s", cookie.Name)
		}
		if strings.Contains(response.Body.String(), cookie.Value) {
			t.Fatalf("raw token %s exposed in response", cookie.Name)
		}
		cookies[cookie.Name] = cookie
	}
	if len(cookies) != 2 || cookies["ft_session"] == nil || cookies["ft_refresh"] == nil {
		t.Fatal("expected both credential cookies")
	}
	if cookies["ft_session"].Path != "/" || cookies["ft_refresh"].Path != "/api/v1/auth/refresh" {
		t.Fatal("credential cookie paths differ from the authentication contract")
	}
	return cookies
}

func checkAuthError(t *testing.T, response *httptest.ResponseRecorder, status int, code string) {
	t.Helper()
	checkNoStore(t, response)
	var body struct {
		Error struct {
			Code    string         `json:"code"`
			Details map[string]any `json:"details"`
		} `json:"error"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if response.Code != status || body.Error.Code != code || body.Error.Details == nil || len(response.Result().Cookies()) != 0 {
		t.Fatalf("status=%d body=%s cookies=%v", response.Code, response.Body, response.Result().Cookies())
	}
}

func checkSessionResponse(t *testing.T, response *httptest.ResponseRecorder, userID int64) {
	t.Helper()
	checkNoStore(t, response)
	var body struct {
		Data struct {
			User      map[string]any `json:"user"`
			Room      *int64         `json:"active_room_id"`
			Version   *string        `json:"active_room_api_version"`
			ExpiresAt time.Time      `json:"session_expires_at"`
		} `json:"data"`
	}
	if response.Code != http.StatusOK || len(response.Result().Cookies()) != 0 {
		t.Fatalf("session lookup failed: %d %s", response.Code, response.Body)
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Data.User) != 2 || body.Data.User["user_id"] != float64(userID) || body.Data.User["username"] != testutil.ValidInput().Username {
		t.Fatal("session must expose only the user's ID and username")
	}
	if body.Data.Room != nil || body.Data.Version != nil || !body.Data.ExpiresAt.After(time.Now()) {
		t.Fatal("incorrect current-session room or expiration")
	}
	if !strings.Contains(response.Body.String(), `"active_room_id":null`) || !strings.Contains(response.Body.String(), `"active_room_api_version":null`) {
		t.Fatal("nullable membership fields must be present")
	}
}

func checkNoStore(t *testing.T, response *httptest.ResponseRecorder) {
	t.Helper()
	if response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("authentication responses must prohibit caching private credentials and identity")
	}
}
