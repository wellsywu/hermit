package auth

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"hermit/internal/store"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type Claims struct {
	Subject string
	IsAdmin bool
}

// Actor represents the identity performing a request.
// Anonymous is true when no valid token was provided.
type Actor struct {
	Subject   string
	IsAdmin   bool
	Anonymous bool
}

// AnonymousActor returns an Actor for unauthenticated requests.
func AnonymousActor() Actor {
	return Actor{Anonymous: true}
}

// ActorFromClaims converts authenticated Claims into an Actor.
func ActorFromClaims(c Claims) Actor {
	return Actor{Subject: c.Subject, IsAdmin: c.IsAdmin}
}

const claimsContextKey = "auth_claims"

// StaticAdminSubject is the identity of requests made with ADMIN_TOKEN.
const StaticAdminSubject = "admin"

// TokenStore is the persistence needed to authenticate tokens.
type TokenStore interface {
	LookupTokenForAuth(ctx context.Context, tokenHash string) (store.TokenAuthRecord, error)
	TouchTokenLastUsed(ctx context.Context, id uuid.UUID)
}

var (
	errTokenDisabled = errors.New("token disabled")
	errTokenExpired  = errors.New("token expired")
	errUserMissing   = errors.New("token subject no longer exists")
	errUserDisabled  = errors.New("user disabled")
	errSessionStale  = errors.New("session issued before password change")
)

type Authenticator struct {
	store      TokenStore
	adminToken string
	now        func() time.Time
}

// NewAuthenticator builds an Authenticator. An empty adminToken disables the
// static super-admin token.
func NewAuthenticator(st TokenStore, adminToken string) *Authenticator {
	return &Authenticator{
		store:      st,
		adminToken: adminToken,
		now:        time.Now,
	}
}

// Middleware requires a valid token; rejects unauthenticated requests.
func (a *Authenticator) Middleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		token := extractToken(c.Request())
		if token == "" {
			return echo.NewHTTPError(http.StatusUnauthorized, "missing API token")
		}

		claims, err := a.Authenticate(c.Request().Context(), token)
		if err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "invalid API token")
		}
		c.Set(claimsContextKey, claims)

		return next(c)
	}
}

// OptionalMiddleware sets claims if a valid token is present but does not
// reject anonymous requests. Anonymous callers get no repository access.
func (a *Authenticator) OptionalMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		token := extractToken(c.Request())
		if token != "" {
			claims, err := a.Authenticate(c.Request().Context(), token)
			if err == nil {
				c.Set(claimsContextKey, claims)
			}
		}
		return next(c)
	}
}

func (a *Authenticator) Authenticate(ctx context.Context, token string) (Claims, error) {
	if a.adminToken != "" &&
		subtle.ConstantTimeCompare([]byte(token), []byte(a.adminToken)) == 1 {
		return Claims{Subject: StaticAdminSubject, IsAdmin: true}, nil
	}

	hash := sha256.Sum256([]byte(token))
	rec, err := a.store.LookupTokenForAuth(ctx, hex.EncodeToString(hash[:]))
	if err != nil {
		return Claims{}, err
	}

	claims, err := evaluateToken(rec, a.now())
	if err != nil {
		return Claims{}, err
	}

	go a.store.TouchTokenLastUsed(context.Background(), rec.TokenID)
	return claims, nil
}

// evaluateToken applies token and live user state. Admin rights always come
// from the users row, never from the value stored on the token.
func evaluateToken(rec store.TokenAuthRecord, now time.Time) (Claims, error) {
	if rec.Disabled {
		return Claims{}, errTokenDisabled
	}
	if rec.ExpiresAt != nil && !now.Before(*rec.ExpiresAt) {
		return Claims{}, errTokenExpired
	}
	if !rec.UserFound {
		return Claims{}, errUserMissing
	}
	if rec.UserDisabled {
		return Claims{}, errUserDisabled
	}
	if rec.TokenType == store.TokenTypeSession && rec.PasswordChangedAt != nil &&
		rec.CreatedAt.Before(*rec.PasswordChangedAt) {
		return Claims{}, errSessionStale
	}
	return Claims{Subject: rec.Subject, IsAdmin: rec.UserIsAdmin}, nil
}

func GetClaims(c echo.Context) (Claims, bool) {
	raw := c.Get(claimsContextKey)
	if raw == nil {
		return Claims{}, false
	}
	claims, ok := raw.(Claims)
	return claims, ok
}

// GetActor returns the Actor for the current request. If the user is
// authenticated, the Actor contains their identity; otherwise it is anonymous.
func GetActor(c echo.Context) Actor {
	claims, ok := GetClaims(c)
	if !ok {
		return AnonymousActor()
	}
	return ActorFromClaims(claims)
}

func extractToken(r *http.Request) string {
	authz := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(authz), "bearer ") {
		return strings.TrimSpace(authz[7:])
	}
	return strings.TrimSpace(r.Header.Get("X-API-Token"))
}
