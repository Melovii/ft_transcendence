package validation

import (
	"encoding/json"
	"io"
	"mime"
	"net/http"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

const maxRegisterBody = 8 << 10

// decodeRegister decodes a bounded registration request.
//
// Parameters:
//
//   - writer: Response writer passed to the request body limiter.
//   - request: Request containing one JSON object with registration fields.
//
// It returns decoded fields for service validation, or a zero RegisterInput on failure.
//
// Errors:
//
//   - ErrInvalidRequest: Invalid content type, body size, JSON structure or unknown fields.
//   - service.ErrInvalidEmail: The email field is missing, null or not a string.
//   - service.ErrInvalidUsername: The username field is missing, null or not a string.
//   - service.ErrInvalidPassword: The password field is missing, null or not a string.
func decodeRegister(writer http.ResponseWriter, request *http.Request) (service.RegisterInput, error) {
	contentType, _, err := mime.ParseMediaType(request.Header.Get("Content-Type"))
	if err != nil || contentType != "application/json" {
		return service.RegisterInput{}, ErrInvalidRequest
	}

	fields, err := decodeRegisterFields(writer, request)
	if err != nil {
		return service.RegisterInput{}, err
	}
	return registerInput(fields)
}

// decodeRegisterFields requires one bounded JSON object with known fields.
func decodeRegisterFields(writer http.ResponseWriter, request *http.Request) (map[string]json.RawMessage, error) {
	request.Body = http.MaxBytesReader(writer, request.Body, maxRegisterBody)
	decoder := json.NewDecoder(request.Body)

	// Raw fields keep wrong field types distinct from a malformed JSON structure.
	var fields map[string]json.RawMessage
	if err := decoder.Decode(&fields); err != nil || fields == nil {
		return nil, ErrInvalidRequest
	}

	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return nil, ErrInvalidRequest
	}

	for field := range fields {
		if field != "email" && field != "username" && field != "password" {
			return nil, ErrInvalidRequest
		}
	}

	return fields, nil
}

// registerInput validates the types of the individual registration fields.
func registerInput(fields map[string]json.RawMessage) (service.RegisterInput, error) {
	email, err := stringField(fields["email"], service.ErrInvalidEmail)
	if err != nil {
		return service.RegisterInput{}, err
	}

	username, err := stringField(fields["username"], service.ErrInvalidUsername)
	if err != nil {
		return service.RegisterInput{}, err
	}

	password, err := stringField(fields["password"], service.ErrInvalidPassword)
	if err != nil {
		return service.RegisterInput{}, err
	}

	return service.RegisterInput{Email: email, Username: username, Password: password}, nil
}

func stringField(raw json.RawMessage, fieldError error) (string, error) {
	var value string
	if len(raw) == 0 || string(raw) == "null" || json.Unmarshal(raw, &value) != nil {
		return "", fieldError
	}

	return value, nil
}
