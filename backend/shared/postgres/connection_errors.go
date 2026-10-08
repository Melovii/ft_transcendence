package postgres

import (
	"context"
	"errors"
	"fmt"
)

var (
	// ErrInvalidConfig identifies invalid settings; error messages omit the DSN.
	ErrInvalidConfig = errors.New("postgres: invalid configuration")

	// ErrConnect identifies pool creation or connectivity failures without credentials.
	ErrConnect = errors.New("postgres: connection failed; check configuration and database availability")
)

func connectionError(ctx context.Context, err error) error {
	switch {
	case ctx.Err() != nil:
		return fmt.Errorf("%w: %w", ErrConnect, ctx.Err())

	case errors.Is(err, context.Canceled):
		return fmt.Errorf("%w: %w", ErrConnect, context.Canceled)

	case errors.Is(err, context.DeadlineExceeded):
		return fmt.Errorf("%w: %w", ErrConnect, context.DeadlineExceeded)

	default:
		return ErrConnect
	}
}
