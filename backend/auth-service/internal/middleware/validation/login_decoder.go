package validation

import (
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"net/mail"
	"strings"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

// ErrInvalidLoginRequest identifies invalid login JSON or a forbidden session body.
var ErrInvalidLoginRequest = errors.New("request contains invalid authentication fields")

const maxLoginBody = 8 << 10

func decodeLogin(writer http.ResponseWriter, request *http.Request) (service.LoginInput, error) {
	contentType, _, err := mime.ParseMediaType(request.Header.Get("Content-Type"))
	if err != nil || contentType != "application/json" {
		return service.LoginInput{}, ErrInvalidLoginRequest
	}
	fields, err := decodeLoginFields(writer, request)
	if err != nil {
		return service.LoginInput{}, err
	}
	return loginFields(fields)
}

func decodeLoginFields(writer http.ResponseWriter, request *http.Request) (map[string]json.RawMessage, error) {
	request.Body = http.MaxBytesReader(writer, request.Body, maxLoginBody)
	decoder := json.NewDecoder(request.Body)
	var fields map[string]json.RawMessage
	if err := decoder.Decode(&fields); err != nil || fields == nil {
		return nil, ErrInvalidLoginRequest
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return nil, ErrInvalidLoginRequest
	}
	for field := range fields {
		if field != "email" && field != "password" {
			return nil, ErrInvalidLoginRequest
		}
	}
	return fields, nil
}

func loginFields(fields map[string]json.RawMessage) (service.LoginInput, error) {
	email, err := stringField(fields["email"], ErrInvalidLoginRequest)
	if err != nil {
		return service.LoginInput{}, err
	}
	password, err := stringField(fields["password"], ErrInvalidLoginRequest)
	if err != nil || password == "" {
		return service.LoginInput{}, ErrInvalidLoginRequest
	}
	email = strings.TrimSpace(email)
	if err := validateLoginEmail(email); err != nil {
		return service.LoginInput{}, err
	}
	return service.LoginInput{Email: email, Password: password}, nil
}

func validateLoginEmail(email string) error {
	address, err := mail.ParseAddress(email)
	if err != nil || address.Address != email || len(email) > 254 {
		return ErrInvalidLoginRequest
	}
	return nil
}
