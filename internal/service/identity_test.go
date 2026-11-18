package service

import (
	"errors"
	"testing"
	"time"

	"hermit/internal/store"
)

func TestValidateLocalUsername(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		in      string
		wantErr bool
	}{
		{"plain", "alice", false},
		{"empty", "  ", true},
		{"ldap namespace", "ldap:alice", true},
		{"any colon", "a:b", true},
		{"wildcard", "*", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			err := validateLocalUsername(tt.in)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateLocalUsername(%q) err = %v, wantErr %v", tt.in, err, tt.wantErr)
			}
			if err != nil && !errors.Is(err, ErrInvalidInput) {
				t.Fatalf("err should wrap ErrInvalidInput, got %v", err)
			}
		})
	}
}

func TestLDAPSubject(t *testing.T) {
	t.Parallel()
	if got := LDAPSubject(" alice "); got != "ldap:alice" {
		t.Fatalf("LDAPSubject() = %q", got)
	}
}

func TestPersonalTokenExpiry(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 11, 17, 0, 0, 0, 0, time.UTC)
	intp := func(v int) *int { return &v }

	tests := []struct {
		name     string
		days     *int
		wantNil  bool
		wantDays int
		wantErr  bool
	}{
		{"default is 90 days", nil, false, 90, false},
		{"7 days", intp(7), false, 7, false},
		{"30 days", intp(30), false, 30, false},
		{"never", intp(0), true, 0, false},
		{"unsupported value", intp(365), false, 0, true},
		{"negative", intp(-1), false, 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := personalTokenExpiry(tt.days, now)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}
			if tt.wantNil {
				if got != nil {
					t.Fatalf("want nil expiry, got %v", got)
				}
				return
			}
			want := now.Add(time.Duration(tt.wantDays) * 24 * time.Hour)
			if got == nil || !got.Equal(want) {
				t.Fatalf("expiry = %v, want %v", got, want)
			}
		})
	}
}

func TestCanManageSkill(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name      string
		isAdmin   bool
		role      string
		createdBy string
		subject   string
		want      bool
	}{
		{"global admin", true, "", "bob", "alice", true},
		{"repo admin on someone else's skill", false, store.RoleAdmin, "bob", "alice", true},
		{"push on own skill", false, store.RolePush, "alice", "alice", true},
		{"push on someone else's skill", false, store.RolePush, "bob", "alice", false},
		{"read on own skill", false, store.RoleRead, "alice", "alice", false},
		{"no role", false, "", "alice", "alice", false},
		{"empty subject never matches", false, store.RolePush, "", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := canManageSkill(tt.isAdmin, tt.role, tt.createdBy, tt.subject); got != tt.want {
				t.Fatalf("canManageSkill() = %v, want %v", got, tt.want)
			}
		})
	}
}
