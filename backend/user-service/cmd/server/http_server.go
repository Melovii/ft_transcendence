package main

import (
	"context"
	"errors"
	"net/http"
	"time"
)

const shutdownTimeout = 10 * time.Second

// runHTTPServer serves HTTP until shutdown or a listener failure.
//
// Parameters:
//
//   - ctx: Cancellation starts graceful shutdown with a separate shutdown timeout.
//   - server: HTTP server containing the listener settings and handler.
//
// It returns nil after a normal shutdown.
//
// Errors:
//
//   - Listener errors: The HTTP server could not start or stopped unexpectedly.
//   - Shutdown errors: Graceful shutdown failed or exceeded its timeout; the server is then closed.
func runHTTPServer(ctx context.Context, server *http.Server) error {
	serverErrors := make(chan error, 1)
	go func() {
		serverErrors <- server.ListenAndServe()
	}()

	select {
	case err := <-serverErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}

		return err

	case <-ctx.Done():
		return shutdownHTTPServer(server)
	}
}

func shutdownHTTPServer(server *http.Server) error {
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		_ = server.Close()
		return err
	}

	return nil
}
