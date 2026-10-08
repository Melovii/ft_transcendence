package testutil

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/security"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

// TestSigningKey is signing material for tests, never for deployed services.
const TestSigningKey = "test-only-signing-key-at-least-32-bytes-long"

// ValidInput provides reusable valid registration data.
//
// Parameters:
//
//   - None.
//
// Flow:
//
//  1. Construct a RegisterInput with fixed email, username and password values.
//
// Expected output:
//
//   - Email=player@example.com, Username=player_one, Password=Correct-Horse-1.
func ValidInput() service.RegisterInput {
	return service.RegisterInput{Email: "player@example.com", Username: "player_one", Password: "Correct-Horse-1"}
}

// TokenIssuer creates the credential issuer used by tests.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - TestSigningKey; access TTL=30 minutes; refresh TTL=30 days.
//
// Flow:
//
//  1. Create an HS256 token issuer; fail the test if initialization fails.
//
// Expected output:
//
//   - A *security.TokenIssuer configured with the test key and lifetimes.
func TokenIssuer(t *testing.T) *security.TokenIssuer {
	t.Helper()
	issuer, err := security.NewTokenIssuer([]byte(TestSigningKey), 30*time.Minute, 30*24*time.Hour)
	if err != nil {
		t.Fatal(err)
	}

	return issuer
}

// ParseClaims validates and decodes an access JWT using the test key.
//
// Parameters:
//
//   - t: Go test runner used to report token validation failures.
//   - raw: Signed access JWT to validate.
//
// Flow:
//
//  1. Parse raw into security.Claims, requiring HS256, the configured issuer/audience and an
//     expiration claim.
//  2. Fail the test on a parsing or validation error.
//
// Expected output:
//
//   - Validated *security.Claims from the access token.
func ParseClaims(t *testing.T, raw string) *security.Claims {
	t.Helper()
	claims := &security.Claims{}
	_, err := jwt.ParseWithClaims(raw, claims, func(*jwt.Token) (any, error) {
		return []byte(TestSigningKey), nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer(security.Issuer), jwt.WithAudience(security.Audience), jwt.WithExpirationRequired())
	if err != nil {
		t.Fatal(err)
	}

	return claims
}

// IssuerFunc adapts a callback to service.CredentialIssuer for injected test behavior.
type IssuerFunc func(int64) (security.Credentials, error)

// Issue adapts a test callback to CredentialIssuer.
//
// Parameters:
//
//   - fn: Callback implementing credential issuance or an injected failure.
//   - id: User ID passed unchanged to the callback.
//
// Flow:
//
//  1. Call fn with the supplied user ID and forward both return values.
//
// Expected output:
//
//   - Exactly the credentials and error produced by fn.
func (fn IssuerFunc) Issue(id int64) (security.Credentials, error) { return fn(id) }
