package unit_test

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/security"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/testutil"
)

type invalidClaimsCase struct {
	name   string
	mutate func(*security.Claims)
}

func TestVerifyAccessAcceptsIssuedCredentials(t *testing.T) {
	issuer := accessTestIssuer(t)
	credentials, err := issuer.Issue(42)
	if err != nil {
		t.Fatal(err)
	}
	identity, err := issuer.VerifyAccess(credentials.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	if identity.UserID != 42 || identity.SessionID != credentials.Session.ID || !identity.ExpiresAt.Equal(credentials.AccessExpiresAt) {
		t.Fatal("verified identity does not match the issued credentials")
	}
}

func TestVerifyAccessRejectsInvalidClaims(t *testing.T) {
	issuer := accessTestIssuer(t)
	cases := append(invalidRegisteredClaims(), invalidIdentityClaims()...)
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			claims := validAccessClaims()
			test.mutate(&claims)
			raw := signTestAccess(t, claims, jwt.SigningMethodHS256, []byte(testutil.TestSigningKey))
			assertInvalidAccess(t, issuer, raw)
		})
	}
}

func invalidRegisteredClaims() []invalidClaimsCase {
	return []invalidClaimsCase{
		{"expired", func(c *security.Claims) { c.ExpiresAt = jwt.NewNumericDate(time.Now().Add(-time.Minute)) }},
		{"missing_exp", func(c *security.Claims) { c.ExpiresAt = nil }},
		{"wrong_issuer", func(c *security.Claims) { c.Issuer = "another-service" }},
		{"missing_issuer", func(c *security.Claims) { c.Issuer = "" }},
		{"wrong_audience", func(c *security.Claims) { c.Audience = jwt.ClaimStrings{"another-app"} }},
		{"missing_audience", func(c *security.Claims) { c.Audience = nil }},
		{"future_iat", func(c *security.Claims) { c.IssuedAt = jwt.NewNumericDate(time.Now().Add(time.Minute)) }},
		{"missing_iat", func(c *security.Claims) { c.IssuedAt = nil }},
		{"future_nbf", func(c *security.Claims) { c.NotBefore = jwt.NewNumericDate(time.Now().Add(time.Minute)) }},
		{"missing_nbf", func(c *security.Claims) { c.NotBefore = nil }},
	}
}

func invalidIdentityClaims() []invalidClaimsCase {
	return []invalidClaimsCase{
		{"missing_subject", func(c *security.Claims) { c.Subject = "" }},
		{"zero_subject", func(c *security.Claims) { c.Subject = "0" }},
		{"negative_subject", func(c *security.Claims) { c.Subject = "-42" }},
		{"non_numeric_subject", func(c *security.Claims) { c.Subject = "person" }},
		{"overflow_subject", func(c *security.Claims) { c.Subject = "9223372036854775808" }},
		{"prefixed_subject", func(c *security.Claims) { c.Subject = "+42" }},
		{"leading_zero_subject", func(c *security.Claims) { c.Subject = "042" }},
		{"missing_session", func(c *security.Claims) { c.SessionID = "" }},
		{"malformed_session", func(c *security.Claims) { c.SessionID = "session-1" }},
		{"invalid_hex_session", func(c *security.Claims) { c.SessionID = "zzzzzzzz-0000-4000-8000-000000000000" }},
	}
}

func TestVerifyAccessRejectsInvalidSignatureAndAlgorithm(t *testing.T) {
	issuer := accessTestIssuer(t)
	claims := validAccessClaims()
	cases := []struct{ name, raw string }{
		{"wrong_algorithm", signTestAccess(t, claims, jwt.SigningMethodHS384, []byte(testutil.TestSigningKey))},
		{"none_algorithm", signTestAccess(t, claims, jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType)},
		{"wrong_key", signTestAccess(t, claims, jwt.SigningMethodHS256, []byte(strings.Repeat("x", 32)))},
		{"malformed_token", "this-is-not-a-jwt"},
		{"empty_token", ""},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) { assertInvalidAccess(t, issuer, test.raw) })
	}
}

func TestRotatePreservesSessionAndReplacesRefreshSecret(t *testing.T) {
	issuer := accessTestIssuer(t)
	original, err := issuer.Issue(42)
	if err != nil {
		t.Fatal(err)
	}
	rotated, err := issuer.Rotate(42, original.Session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if rotated.Session.ID != original.Session.ID || rotated.Refresh.SessionID != original.Session.ID || rotated.Session.UserID != 42 {
		t.Fatal("rotation changed session ownership or ID")
	}
	identity, err := issuer.VerifyAccess(rotated.AccessToken)
	if err != nil || identity.SessionID != original.Session.ID || identity.UserID != 42 {
		t.Fatalf("rotated access token has the wrong identity: %+v, %v", identity, err)
	}
	assertRotatedRefresh(t, original, rotated)
}

func assertRotatedRefresh(t *testing.T, original, rotated security.Credentials) {
	t.Helper()
	if rotated.Refresh.ID == original.Refresh.ID || rotated.RefreshToken == original.RefreshToken || rotated.Refresh.TokenHash == original.Refresh.TokenHash {
		t.Fatal("rotation reused the refresh secret or identifier")
	}
	hash := sha256.Sum256([]byte(rotated.RefreshToken))
	if rotated.Refresh.TokenHash != hex.EncodeToString(hash[:]) {
		t.Fatal("refresh persistence must contain only the new secret hash")
	}
	if rotated.Refresh.ExpiresAt.Sub(rotated.Refresh.CreatedAt) != 30*24*time.Hour {
		t.Fatal("rotated refresh expiration does not match the configured lifetime")
	}
}

func TestRotateRejectsInvalidIdentity(t *testing.T) {
	issuer := accessTestIssuer(t)
	for _, test := range []struct {
		userID    int64
		sessionID string
	}{{0, validAccessClaims().SessionID}, {-42, validAccessClaims().SessionID}, {42, ""}, {42, "bad-session"}} {
		credentials, err := issuer.Rotate(test.userID, test.sessionID)
		if err == nil || credentials.AccessToken != "" || credentials.RefreshToken != "" {
			t.Fatalf("rotation accepted an invalid identity: %+v", test)
		}
	}
}

func accessTestIssuer(t *testing.T) *security.TokenIssuer {
	t.Helper()
	issuer, err := security.NewTokenIssuer([]byte(testutil.TestSigningKey), 30*time.Minute, 30*24*time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	return issuer
}

func validAccessClaims() security.Claims {
	now := time.Now().UTC().Truncate(time.Second)
	return security.Claims{
		SessionID: "9f6a1d70-8c90-4cba-8aa7-4bbdc2fb685e",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer: security.Issuer, Audience: jwt.ClaimStrings{security.Audience}, Subject: "42",
			IssuedAt: jwt.NewNumericDate(now.Add(-time.Minute)), NotBefore: jwt.NewNumericDate(now.Add(-time.Minute)),
			ExpiresAt: jwt.NewNumericDate(now.Add(30 * time.Minute)),
		},
	}
}

func signTestAccess(t *testing.T, claims security.Claims, method jwt.SigningMethod, key any) string {
	t.Helper()
	raw, err := jwt.NewWithClaims(method, claims).SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func assertInvalidAccess(t *testing.T, issuer *security.TokenIssuer, raw string) {
	t.Helper()
	identity, err := issuer.VerifyAccess(raw)
	if !errors.Is(err, security.ErrInvalidAccessToken) || identity != (security.AccessIdentity{}) {
		t.Fatalf("invalid access token returned identity=%+v, error=%v", identity, err)
	}
}
