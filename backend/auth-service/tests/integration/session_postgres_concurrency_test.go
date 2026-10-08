package integration_test

import (
	"errors"
	"testing"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/security"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

type postgresRefreshResult struct {
	credentials security.Credentials
	err         error
}

func concurrentPostgresRefresh(f postgresSessionFixture) <-chan postgresRefreshResult {
	start := make(chan struct{})
	results := make(chan postgresRefreshResult, 2)
	for range 2 {
		go func() {
			<-start
			credentials, err := f.auth.Refresh(f.ctx, f.original.Credentials.RefreshToken)
			results <- postgresRefreshResult{credentials: credentials, err: err}
		}()
	}
	close(start)
	return results
}

func assertConcurrentRefreshResults(t *testing.T, f postgresSessionFixture, results <-chan postgresRefreshResult) security.Credentials {
	t.Helper()
	success, rejected := 0, 0
	var replacement security.Credentials
	for range 2 {
		select {
		case result := <-results:
			if result.err == nil {
				success++
				replacement = result.credentials
			} else if errors.Is(result.err, service.ErrSessionExpired) {
				rejected++
			} else {
				t.Fatalf("concurrent refresh error = %v", result.err)
			}
		case <-f.ctx.Done():
			t.Fatalf("concurrent refresh timed out: %v", f.ctx.Err())
		}
	}
	if success != 1 || rejected != 1 || replacement.RefreshToken == "" {
		t.Fatalf("concurrent refresh produced %d successful/%d rejected requests", success, rejected)
	}
	return replacement
}
