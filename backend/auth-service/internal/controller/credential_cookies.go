package controller

import (
	"net/http"
	"time"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/security"
)

func setCredentials(writer http.ResponseWriter, credentials security.Credentials) {
	setCredentialCookie(writer, "ft_session", credentials.AccessToken, "/", credentials.AccessExpiresAt)
	setCredentialCookie(writer, "ft_refresh", credentials.RefreshToken, "/api/v1/auth/refresh", credentials.Refresh.ExpiresAt)
}

func clearCredentials(writer http.ResponseWriter) {
	clearCredentialCookie(writer, "ft_session", "/")
	clearCredentialCookie(writer, "ft_refresh", "/api/v1/auth/refresh")
}

func clearCredentialCookie(writer http.ResponseWriter, name, path string) {
	http.SetCookie(writer, &http.Cookie{
		Name: name, Value: "", Path: path, MaxAge: -1, Expires: time.Unix(1, 0).UTC(),
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})
}
