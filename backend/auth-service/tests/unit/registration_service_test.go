package unit_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/security"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/testutil"
)

// TestRegisterValidation checks normalization and registration field boundaries.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Padded email/username and a password containing surrounding spaces.
//   - Malformed identities; usernames outside 3-20 characters; passwords around the 8-72 byte
//     boundaries, including multibyte text.
//
// Flow:
//
//  1. Validate the padded input and compare normalized fields.
//  2. Replace one field per table case and compare the returned error with want.
//
// Expected output:
//
//   - Email and username are trimmed while case and password whitespace are preserved.
//   - Valid boundary passwords return nil; invalid fields match ErrInvalidEmail,
//     ErrInvalidUsername or ErrInvalidPassword.
func TestRegisterValidation(t *testing.T) {
	checkRegisterNormalization(t)

	for _, tt := range registerValidationCases() {
		t.Run(tt.name, func(t *testing.T) {
			input := testutil.ValidInput()

			switch tt.field {
			case "email":
				input.Email = tt.value

			case "username":
				input.Username = tt.value

			case "password":
				input.Password = tt.value
			}

			_, err := service.ValidateRegister(input)
			if !errors.Is(err, tt.want) {
				t.Fatalf("got %v, want %v", err, tt.want)
			}
		})
	}
}

// TestRegisterFailureResults checks registration failures and transaction atomicity.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Valid input with a failure at user insertion, issuance, session insertion, refresh
//     insertion or commit.
//   - A separate request using an already canceled context.
//
// Flow:
//
//  1. Inject each failure and call AuthService.Register directly.
//  2. Inspect the returned result and committed in-memory records.
//  3. Repeat with a canceled context and inspect the transaction-call count.
//
// Expected output:
//
//   - Every injected failure returns an error, user ID=0 and empty access/refresh tokens, with
//     no committed records.
//   - Canceled input matches context.Canceled and starts zero transactions.
func TestRegisterFailureResults(t *testing.T) {
	for _, stage := range []string{"user", "issuer", "session", "refresh", "commit"} {
		t.Run(stage, func(t *testing.T) {
			repo := &testutil.MemoryRepository{FailAt: stage}
			var issuer service.CredentialIssuer = testutil.TokenIssuer(t)
			if stage == "issuer" {
				issuer = testutil.IssuerFunc(func(int64) (security.Credentials, error) {
					return security.Credentials{}, errors.New("signing failure")
				})
			}

			if stage == "commit" {
				repo.CommitErr = errors.New("commit failure")
			}

			result, err := service.NewAuth(repo, issuer).Register(context.Background(), testutil.ValidInput())
			if err == nil || result.User.ID != 0 || result.Credentials.AccessToken != "" || result.Credentials.RefreshToken != "" {
				t.Fatal("failed registration exposed a success result")
			}

			if len(repo.Users)+len(repo.Sessions)+len(repo.Refresh) != 0 {
				t.Fatal("failed transaction persisted partial state")
			}
		})
	}

	checkCanceledRegistration(t)
}

func checkRegisterNormalization(t *testing.T) {
	t.Helper()
	input := testutil.ValidInput()
	input.Email, input.Username, input.Password = " Player@Example.com ", " Player_One ", "  password  "
	got, err := service.ValidateRegister(input)
	if err != nil || got.Email != "Player@Example.com" || got.Username != "Player_One" || got.Password != input.Password {
		t.Fatalf("normalization: %+v", err)
	}
}

type registerValidationCase struct {
	name, field, value string
	want               error
}

func registerValidationCases() []registerValidationCase {
	return []registerValidationCase{
		{"missing email", "email", "", service.ErrInvalidEmail},
		{"bad email", "email", "bad", service.ErrInvalidEmail},
		{"display name", "email", "Player <player@example.com>", service.ErrInvalidEmail},
		{"short username", "username", "ab", service.ErrInvalidUsername},
		{"long username", "username", strings.Repeat("a", 21), service.ErrInvalidUsername},
		{"invalid username", "username", "player-one", service.ErrInvalidUsername},
		{"short password", "password", "1234567", service.ErrInvalidPassword},
		{"long password", "password", strings.Repeat("a", 73), service.ErrInvalidPassword},
		{"multibyte overflow", "password", strings.Repeat("é", 37), service.ErrInvalidPassword},
		{"minimum password", "password", "12345678", nil},
		{"maximum password", "password", strings.Repeat("é", 36), nil},
	}
}

func checkCanceledRegistration(t *testing.T) {
	t.Helper()
	repo := &testutil.MemoryRepository{}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := service.NewAuth(repo, testutil.TokenIssuer(t)).Register(ctx, testutil.ValidInput())
	if !errors.Is(err, context.Canceled) || repo.Calls != 0 {
		t.Fatal("canceled registration must not start persistence")
	}
}
