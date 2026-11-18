package auth

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"hermit/internal/store"

	"github.com/google/uuid"
)

func TestExtractToken_BearerHeader(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		authz string
		want  string
	}{
		{"standard bearer", "Bearer my-token-123", "my-token-123"},
		{"lowercase bearer", "bearer my-token", "my-token"},
		{"bearer with extra spaces", "Bearer   spaced  ", "spaced"},
		{"empty bearer", "Bearer ", ""},
		{"non-bearer auth", "Basic dXNlcjpwYXNz", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			r, _ := http.NewRequest("GET", "/", nil)
			r.Header.Set("Authorization", tt.authz)
			got := extractToken(r)
			if got != tt.want {
				t.Fatalf("extractToken() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestExtractToken_XAPITokenHeader(t *testing.T) {
	t.Parallel()
	r, _ := http.NewRequest("GET", "/", nil)
	r.Header.Set("X-API-Token", "  tok-456  ")
	got := extractToken(r)
	if got != "tok-456" {
		t.Fatalf("extractToken() = %q, want %q", got, "tok-456")
	}
}

func TestExtractToken_BearerTakesPrecedence(t *testing.T) {
	t.Parallel()
	r, _ := http.NewRequest("GET", "/", nil)
	r.Header.Set("Authorization", "Bearer from-bearer")
	r.Header.Set("X-API-Token", "from-header")
	got := extractToken(r)
	if got != "from-bearer" {
		t.Fatalf("extractToken() = %q, want %q", got, "from-bearer")
	}
}

func TestExtractToken_NoHeaders(t *testing.T) {
	t.Parallel()
	r, _ := http.NewRequest("GET", "/", nil)
	got := extractToken(r)
	if got != "" {
		t.Fatalf("extractToken() = %q, want empty", got)
	}
}

func TestAnonymousActor(t *testing.T) {
	t.Parallel()
	a := AnonymousActor()
	if !a.Anonymous {
		t.Fatal("AnonymousActor().Anonymous should be true")
	}
	if a.Subject != "" {
		t.Fatalf("AnonymousActor().Subject = %q, want empty", a.Subject)
	}
	if a.IsAdmin {
		t.Fatal("AnonymousActor().IsAdmin should be false")
	}
}

func TestActorFromClaims(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		claims  Claims
		wantSub string
		wantAdm bool
	}{
		{"admin", Claims{Subject: "admin", IsAdmin: true}, "admin", true},
		{"regular user", Claims{Subject: "user1", IsAdmin: false}, "user1", false},
		{"empty", Claims{}, "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			a := ActorFromClaims(tt.claims)
			if a.Subject != tt.wantSub {
				t.Fatalf("Subject = %q, want %q", a.Subject, tt.wantSub)
			}
			if a.IsAdmin != tt.wantAdm {
				t.Fatalf("IsAdmin = %v, want %v", a.IsAdmin, tt.wantAdm)
			}
			if a.Anonymous {
				t.Fatal("ActorFromClaims should not be anonymous")
			}
		})
	}
}

type fakeTokenStore struct {
	rec store.TokenAuthRecord
	err error
}

func (f *fakeTokenStore) LookupTokenForAuth(context.Context, string) (store.TokenAuthRecord, error) {
	return f.rec, f.err
}

func (f *fakeTokenStore) TouchTokenLastUsed(context.Context, uuid.UUID) {}

func TestEvaluateToken(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 11, 17, 12, 0, 0, 0, time.UTC)
	past := now.Add(-time.Hour)
	future := now.Add(time.Hour)
	base := store.TokenAuthRecord{
		Subject:   "alice",
		TokenType: store.TokenTypePersonal,
		CreatedAt: now.Add(-2 * time.Hour),
		UserFound: true,
	}
	with := func(f func(*store.TokenAuthRecord)) store.TokenAuthRecord {
		r := base
		f(&r)
		return r
	}

	tests := []struct {
		name      string
		rec       store.TokenAuthRecord
		wantErr   error
		wantAdmin bool
	}{
		{"valid", base, nil, false},
		{"admin comes from live user row", with(func(r *store.TokenAuthRecord) { r.UserIsAdmin = true }), nil, true},
		{"disabled token", with(func(r *store.TokenAuthRecord) { r.Disabled = true }), errTokenDisabled, false},
		{"expired", with(func(r *store.TokenAuthRecord) { r.ExpiresAt = &past }), errTokenExpired, false},
		{"expires exactly now", with(func(r *store.TokenAuthRecord) { r.ExpiresAt = &now }), errTokenExpired, false},
		{"not yet expired", with(func(r *store.TokenAuthRecord) { r.ExpiresAt = &future }), nil, false},
		{"deleted user", with(func(r *store.TokenAuthRecord) { r.UserFound = false }), errUserMissing, false},
		{"disabled user", with(func(r *store.TokenAuthRecord) { r.UserDisabled = true }), errUserDisabled, false},
		{"session before password change", with(func(r *store.TokenAuthRecord) {
			r.TokenType = store.TokenTypeSession
			r.PasswordChangedAt = &past
		}), errSessionStale, false},
		{"session after password change", with(func(r *store.TokenAuthRecord) {
			r.TokenType = store.TokenTypeSession
			r.CreatedAt = now.Add(-time.Minute)
			r.PasswordChangedAt = &past
		}), nil, false},
		{"personal token survives password change", with(func(r *store.TokenAuthRecord) {
			r.PasswordChangedAt = &past
		}), nil, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			claims, err := evaluateToken(tt.rec, now)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if err == nil && claims.IsAdmin != tt.wantAdmin {
				t.Fatalf("IsAdmin = %v, want %v", claims.IsAdmin, tt.wantAdmin)
			}
		})
	}
}

func TestAuthenticate_StaticAdminToken(t *testing.T) {
	t.Parallel()
	st := &fakeTokenStore{err: errors.New("db should not be hit")}
	a := NewAuthenticator(st, "static-admin-token-0123456789abcdef")

	claims, err := a.Authenticate(context.Background(), "static-admin-token-0123456789abcdef")
	if err != nil || !claims.IsAdmin || claims.Subject != StaticAdminSubject {
		t.Fatalf("static admin: claims=%+v err=%v", claims, err)
	}
	if _, err := a.Authenticate(context.Background(), "wrong"); err == nil {
		t.Fatal("wrong token should fail")
	}
}

func TestAuthenticate_EmptyAdminTokenDisabled(t *testing.T) {
	t.Parallel()
	st := &fakeTokenStore{err: errors.New("not found")}
	a := NewAuthenticator(st, "")
	if _, err := a.Authenticate(context.Background(), ""); err == nil {
		t.Fatal("empty token must not match a disabled static admin token")
	}
}

func TestAuthenticate_UsesLiveAdminFlag(t *testing.T) {
	t.Parallel()
	st := &fakeTokenStore{rec: store.TokenAuthRecord{
		Subject: "bob", TokenType: store.TokenTypePersonal, CreatedAt: time.Now(),
		UserFound: true, UserIsAdmin: false,
	}}
	a := NewAuthenticator(st, "")
	claims, err := a.Authenticate(context.Background(), "some-token")
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if claims.IsAdmin {
		t.Fatal("demoted user must not be admin")
	}
}
