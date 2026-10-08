package unit_test

import (
	"encoding/json"
	"regexp"
	"testing"
	"time"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/security"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/testutil"
)

// TestCredentialIssuer checks token generation and issuer configuration boundaries.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - The test signing key; access TTL=30 minutes; refresh TTL=30 days; user ID=42.
//   - User ID=0, a short signing key, invalid access lifetimes and refresh lifetimes not
//     greater than access.
//
// Flow:
//
//  1. Create the issuer, mutate the original key and issue credentials twice for the same user.
//  2. Validate UUIDv4 IDs, unique session/refresh values, signed claims and expiry metadata.
//  3. Marshal credentials and exercise invalid user/configuration cases.
//
// Expected output:
//
//   - Both issuances succeed with distinct session IDs, refresh IDs and refresh values.
//   - The first JWT validates with the original key, sub=42 and its session sid; expirations
//     match the configured TTLs.
//   - Credentials marshal to {}; invalid user IDs and issuer settings return errors.
func TestCredentialIssuer(t *testing.T) {
	key := []byte(testutil.TestSigningKey)
	issuer, err := security.NewTokenIssuer(key, 30*time.Minute, 30*24*time.Hour)
	if err != nil {
		t.Fatal(err)
	}

	key[0] ^= 1 // The issuer must own a copy of the original key.
	first, err := issuer.Issue(42)
	if err != nil {
		t.Fatal(err)
	}

	second, err := issuer.Issue(42)
	if err != nil {
		t.Fatal(err)
	}

	if first.Session.ID == second.Session.ID || first.RefreshToken == second.RefreshToken || first.Refresh.ID == second.Refresh.ID {
		t.Fatal("credentials must be unique per login")
	}

	checkIssuedClaims(t, first)

	checkCredentialsSerialization(t, first)
	checkInvalidIssuerSettings(t, issuer)
}

func checkInvalidIssuerSettings(t *testing.T, issuer *security.TokenIssuer) {
	t.Helper()
	if _, err := issuer.Issue(0); err == nil {
		t.Fatal("invalid user ID accepted")
	}

	for _, settings := range []struct {
		key             string
		access, refresh time.Duration
	}{
		{"short", time.Minute, time.Hour},
		{testutil.TestSigningKey, 0, time.Hour},
		{testutil.TestSigningKey, time.Millisecond, time.Hour},
		{testutil.TestSigningKey, time.Hour, time.Hour},
		{testutil.TestSigningKey, time.Hour, time.Minute},
	} {
		if _, err := security.NewTokenIssuer([]byte(settings.key), settings.access, settings.refresh); err == nil {
			t.Fatal("invalid issuer settings accepted")
		}
	}
}

func checkIssuedClaims(t *testing.T, first security.Credentials) {
	t.Helper()
	uuid := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	if !uuid.MatchString(first.Session.ID) || !uuid.MatchString(first.Refresh.ID) {
		t.Fatal("session and refresh IDs must be UUIDv4")
	}

	claims := testutil.ParseClaims(t, first.AccessToken)
	if claims.Subject != "42" || claims.SessionID != first.Session.ID || claims.ExpiresAt.Sub(claims.IssuedAt.Time) != 30*time.Minute {
		t.Fatal("incorrect signed claims")
	}

	if !claims.ExpiresAt.Equal(first.AccessExpiresAt) || first.Refresh.ExpiresAt.Sub(first.Refresh.CreatedAt) != 30*24*time.Hour {
		t.Fatal("token expiry metadata must match configured TTLs")
	}
}

func checkCredentialsSerialization(t *testing.T, first security.Credentials) {
	t.Helper()
	data, err := json.Marshal(first)
	if err != nil || string(data) != "{}" {
		t.Fatal("credentials must not serialize to JSON")
	}
}
