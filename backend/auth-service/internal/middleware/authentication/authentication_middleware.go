// Package authentication guards routes using the verified access cookie and active session.
package authentication

import (
	"context"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
	"github.com/melmut-42/ft_transcendence/backend/shared/httpresponse"
)

type Authenticator interface {
	Authenticate(context.Context, string) (service.Identity, error)
}

const ginContextKey = "auth.identity"

type contextKey struct{}

// Middleware accepts ft_session cookies and stores the authenticated identity.
func Middleware(auth Authenticator) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, err := c.Cookie("ft_session")
		if err != nil || raw == "" {
			abort(c, service.ErrUnauthorized)
			return
		}
		identity, err := auth.Authenticate(c.Request.Context(), raw)
		if err != nil {
			abort(c, err)
			return
		}
		c.Set(ginContextKey, identity)
		ctx := context.WithValue(c.Request.Context(), contextKey{}, identity)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

func abort(c *gin.Context, err error) {
	response := httpresponse.InternalError()
	if errors.Is(err, service.ErrUnauthorized) {
		response = &httpresponse.Error{
			Status: http.StatusUnauthorized, Code: "UNAUTHORIZED", Message: "A valid active session is required.",
		}
	}
	c.Abort()
	httpresponse.WriteError(c.Writer, response)
}

// Get retrieves the identity installed on the Gin context.
func Get(c *gin.Context) (service.Identity, bool) {
	value, ok := c.Get(ginContextKey)
	if !ok {
		return service.Identity{}, false
	}
	identity, ok := value.(service.Identity)
	return identity, ok
}

// FromContext retrieves the identity installed on the request context.
func FromContext(ctx context.Context) (service.Identity, bool) {
	identity, ok := ctx.Value(contextKey{}).(service.Identity)
	return identity, ok
}
