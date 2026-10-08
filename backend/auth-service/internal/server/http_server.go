package server

import (
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/controller"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/middleware/requestid"
	authrouter "github.com/melmut-42/ft_transcendence/backend/auth-service/internal/router"
	"github.com/melmut-42/ft_transcendence/backend/shared/httpresponse"
)

const (
	readHeaderTimeout = 5 * time.Second
	idleTimeout       = 60 * time.Second
)

// New assembles the auth HTTP server without opening its listener.
//
// Parameters:
//
//   - port: Port used by the caller when starting the listener.
//   - auth: Controller registering the auth routes.
//   - logger: Service logger receiving access and panic records.
//
// It returns an unstarted server with auth routes, request IDs, access logging
// and panic recovery. The caller owns startup and shutdown.
func New(port string, auth *controller.AuthController, logger *slog.Logger) *http.Server {

	return &http.Server{
		Addr:              ":" + port,
		Handler:           newRouter(auth, logger),
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		ReadHeaderTimeout: readHeaderTimeout,
		IdleTimeout:       idleTimeout,
	}
}

// newRouter wires auth routes and the common HTTP middleware.
func newRouter(auth *controller.AuthController, logger *slog.Logger) *gin.Engine {
	router := gin.New()
	router.Use(requestid.Middleware(), requestLogger(logger), gin.CustomRecoveryWithWriter(io.Discard, func(c *gin.Context, _ any) {
		logger.ErrorContext(c.Request.Context(), "http_panic", "request_id", requestid.Get(c))
		authrouter.WriteError(c, httpresponse.InternalError())
	}))
	_ = router.SetTrustedProxies(nil)
	router.NoRoute(authrouter.Wrap(func(c *gin.Context) error {
		return &httpresponse.Error{Status: http.StatusNotFound, Code: "NOT_FOUND", Message: "The requested endpoint was not found."}
	}, nil))
	router.HandleMethodNotAllowed = true
	router.NoMethod(authrouter.Wrap(func(c *gin.Context) error {
		return &httpresponse.Error{Status: http.StatusMethodNotAllowed, Code: "METHOD_NOT_ALLOWED", Message: "The HTTP method is not allowed for this endpoint."}
	}, nil))
	auth.RegisterRoutes(router.Group("/api/v1/auth"))

	return router
}
