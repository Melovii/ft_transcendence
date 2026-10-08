package security

import (
	"errors"
	"regexp"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// ErrInvalidAccessToken covers malformed, unverifiable or expired access credentials.
var ErrInvalidAccessToken = errors.New("invalid access token")

var sessionIDPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// AccessIdentity contains verified claims; active session ownership is checked by the service.
type AccessIdentity struct {
	UserID    int64
	SessionID string
	ExpiresAt time.Time
}

// VerifyAccess checks the signature and all access claims without exposing parser errors.
func (i *TokenIssuer) VerifyAccess(raw string) (AccessIdentity, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(token *jwt.Token) (any, error) {
		return i.key, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(Issuer), jwt.WithAudience(Audience), jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(), jwt.WithNotBeforeRequired(), jwt.WithStrictDecoding())
	if err != nil || !token.Valid {
		return AccessIdentity{}, ErrInvalidAccessToken
	}
	return identityFromClaims(claims)
}

func identityFromClaims(claims *Claims) (AccessIdentity, error) {
	userID, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil || userID <= 0 || strconv.FormatInt(userID, 10) != claims.Subject {
		return AccessIdentity{}, ErrInvalidAccessToken
	}
	if !validSessionID(claims.SessionID) || claims.ExpiresAt == nil || claims.IssuedAt == nil || claims.NotBefore == nil {
		return AccessIdentity{}, ErrInvalidAccessToken
	}
	if !claims.ExpiresAt.After(claims.IssuedAt.Time) || !claims.ExpiresAt.After(claims.NotBefore.Time) {
		return AccessIdentity{}, ErrInvalidAccessToken
	}
	return AccessIdentity{UserID: userID, SessionID: claims.SessionID, ExpiresAt: claims.ExpiresAt.Time}, nil
}

func validSessionID(id string) bool {
	return sessionIDPattern.MatchString(id)
}
