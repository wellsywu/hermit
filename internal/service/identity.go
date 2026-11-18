package service

import (
	"fmt"
	"strings"
	"time"

	"hermit/internal/store"
)

const (
	// LDAPSubjectPrefix namespaces LDAP identities so they never collide with local accounts.
	LDAPSubjectPrefix = "ldap:"
	// WildcardSubject in repo_members grants a role to every signed-in user.
	WildcardSubject = "*"
	// SystemActor is recorded as granted_by for roles created at bootstrap.
	SystemActor = "system"

	DefaultSessionTTL         = 168 * time.Hour
	DefaultPersonalTokenDays  = 90
	personalTokenNeverExpires = 0
)

// AllowedPersonalTokenDays lists the accepted expires_in_days values (0 = never).
var AllowedPersonalTokenDays = []int{7, 30, 90, personalTokenNeverExpires}

// LDAPSubject returns the namespaced subject for an LDAP username.
func LDAPSubject(username string) string {
	return LDAPSubjectPrefix + strings.TrimSpace(username)
}

// validateLocalUsername rejects names that could impersonate a namespaced or wildcard subject.
func validateLocalUsername(username string) error {
	username = strings.TrimSpace(username)
	if username == "" {
		return fmt.Errorf("%w: username required", ErrInvalidInput)
	}
	if strings.Contains(username, ":") {
		return fmt.Errorf("%w: username must not contain ':'", ErrInvalidInput)
	}
	if username == WildcardSubject {
		return fmt.Errorf("%w: username '*' is reserved", ErrInvalidInput)
	}
	return nil
}

// personalTokenExpiry converts expires_in_days to an absolute time.
// nil means the default (90 days); 0 means never expires.
func personalTokenExpiry(days *int, now time.Time) (*time.Time, error) {
	d := DefaultPersonalTokenDays
	if days != nil {
		d = *days
	}
	allowed := false
	for _, v := range AllowedPersonalTokenDays {
		if v == d {
			allowed = true
			break
		}
	}
	if !allowed {
		return nil, fmt.Errorf("%w: expires_in_days must be one of 7, 30, 90 or 0 (never)", ErrInvalidInput)
	}
	if d == personalTokenNeverExpires {
		return nil, nil
	}
	t := now.Add(time.Duration(d) * 24 * time.Hour)
	return &t, nil
}

// canManageSkill decides whether a caller may delete or restore a skill:
// global admins, repository admins, or the creator holding push rights.
func canManageSkill(isAdmin bool, repoRole string, createdBy, subject string) bool {
	if isAdmin || repoRole == store.RoleAdmin {
		return true
	}
	return repoRole == store.RolePush && subject != "" && createdBy == subject
}
