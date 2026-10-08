package validation

import (
	"github.com/gin-gonic/gin"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

const registerInputKey = "auth.validatedRegisterInput"

// ValidateRegister decodes and validates registration requests before the handler.
//
// Parameters:
//
//   - c: Gin context containing the registration request.
//
// It stores normalized input and returns nil on success. Mount it through
// router.Wrap so invalid requests abort the chain and receive a JSON error.
//
// Errors:
//
//   - ErrInvalidRequest: Content type, body size or JSON structure is invalid.
//   - service.ErrInvalidEmail: Email is missing, incorrectly typed or invalid.
//   - service.ErrInvalidUsername: Username is missing, incorrectly typed or invalid.
//   - service.ErrInvalidPassword: Password is missing, incorrectly typed or invalid.
func ValidateRegister(c *gin.Context) error {
	input, err := decodeRegister(c.Writer, c.Request)
	if err != nil {
		return err
	}

	input, err = service.ValidateRegister(input)
	if err != nil {
		return err
	}

	c.Set(registerInputKey, input)
	return nil
}

// RegisterInput returns validated request input and whether the middleware supplied it.
func RegisterInput(c *gin.Context) (service.RegisterInput, bool) {
	value, exists := c.Get(registerInputKey)
	if !exists {
		return service.RegisterInput{}, false
	}

	input, ok := value.(service.RegisterInput)
	return input, ok
}
