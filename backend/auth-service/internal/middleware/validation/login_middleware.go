package validation

import (
	"github.com/gin-gonic/gin"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

const loginInputKey = "auth.validatedLoginInput"

// ValidateLogin stores bounded, well-formed email/password input before dispatch.
func ValidateLogin(c *gin.Context) error {
	input, err := decodeLogin(c.Writer, c.Request)
	if err != nil {
		return err
	}
	c.Set(loginInputKey, input)
	return nil
}

// LoginInput returns the input supplied by the login validation middleware.
func LoginInput(c *gin.Context) (service.LoginInput, bool) {
	value, exists := c.Get(loginInputKey)
	if !exists {
		return service.LoginInput{}, false
	}
	input, ok := value.(service.LoginInput)
	return input, ok
}
