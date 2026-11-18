package store

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	TokenTypeSession  = "session"
	TokenTypePersonal = "personal"
)

// APIToken represents a row in the api_tokens table.
type APIToken struct {
	ID         uuid.UUID  `json:"id"`
	Subject    string     `json:"subject"`
	Name       string     `json:"name"`
	TokenType  string     `json:"token_type"`
	IsAdmin    bool       `json:"is_admin"`
	Disabled   bool       `json:"disabled"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt  *time.Time `json:"expires_at"`
}

// TokenAuthRecord is a token joined with the live state of its user.
// UserFound is false when no users row matches the token subject.
type TokenAuthRecord struct {
	TokenID           uuid.UUID
	Subject           string
	TokenType         string
	Disabled          bool
	CreatedAt         time.Time
	ExpiresAt         *time.Time
	UserFound         bool
	UserIsAdmin       bool
	UserDisabled      bool
	PasswordChangedAt *time.Time
}

// LookupTokenForAuth fetches a token by hash together with its user's current state.
func (s *Store) LookupTokenForAuth(ctx context.Context, tokenHash string) (TokenAuthRecord, error) {
	var r TokenAuthRecord
	err := s.db.QueryRow(ctx, `
		SELECT t.id, t.subject, t.token_type, t.disabled, t.created_at, t.expires_at,
		       u.id IS NOT NULL, COALESCE(u.is_admin, FALSE), COALESCE(u.disabled, FALSE),
		       u.password_changed_at
		FROM api_tokens t
		LEFT JOIN users u ON u.username = t.subject
		WHERE t.token_hash = $1
	`, tokenHash).Scan(
		&r.TokenID, &r.Subject, &r.TokenType, &r.Disabled, &r.CreatedAt, &r.ExpiresAt,
		&r.UserFound, &r.UserIsAdmin, &r.UserDisabled, &r.PasswordChangedAt,
	)
	return r, err
}

// TouchTokenLastUsed updates the last_used_at timestamp.
func (s *Store) TouchTokenLastUsed(ctx context.Context, id uuid.UUID) {
	_, _ = s.db.Exec(ctx, `UPDATE api_tokens SET last_used_at = now() WHERE id = $1`, id)
}

// CreatePersonalToken inserts a new personal access token. A nil expiresAt never expires.
func (s *Store) CreatePersonalToken(ctx context.Context, subject, name, tokenHash string, isAdmin bool, expiresAt *time.Time) (uuid.UUID, error) {
	var id uuid.UUID
	err := s.db.QueryRow(ctx, `
		INSERT INTO api_tokens (token_hash, subject, name, token_type, is_admin, expires_at)
		VALUES ($1, $2, $3, 'personal', $4, $5)
		RETURNING id
	`, tokenHash, subject, name, isAdmin, expiresAt).Scan(&id)
	if err != nil {
		if isUniqueViolation(err) {
			return uuid.Nil, ErrConflict
		}
		return uuid.Nil, err
	}
	return id, nil
}

// UpsertSessionToken creates or replaces the session token for a subject.
// Each subject has at most one active session token.
func (s *Store) UpsertSessionToken(ctx context.Context, subject, tokenHash string, isAdmin bool, expiresAt time.Time) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		DELETE FROM api_tokens WHERE subject = $1 AND token_type = 'session'
	`, subject); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO api_tokens (token_hash, subject, name, token_type, is_admin, expires_at)
		VALUES ($1, $2, '', 'session', $3, $4)
	`, tokenHash, subject, isAdmin, expiresAt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ListTokensBySubject returns all personal tokens for a given subject.
func (s *Store) ListTokensBySubject(ctx context.Context, subject string) ([]APIToken, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, subject, name, token_type, is_admin, disabled, created_at, last_used_at, expires_at
		FROM api_tokens
		WHERE subject = $1 AND token_type = 'personal'
		ORDER BY created_at DESC
	`, subject)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tokens []APIToken
	for rows.Next() {
		var t APIToken
		if err := rows.Scan(&t.ID, &t.Subject, &t.Name, &t.TokenType, &t.IsAdmin, &t.Disabled, &t.CreatedAt, &t.LastUsedAt, &t.ExpiresAt); err != nil {
			return nil, err
		}
		tokens = append(tokens, t)
	}
	return tokens, rows.Err()
}

// RevokeToken deletes a token by id, scoped to a subject (unless allAccess).
func (s *Store) RevokeToken(ctx context.Context, tokenID uuid.UUID, subject string, allAccess bool) error {
	var ct pgconn.CommandTag
	var err error
	if allAccess {
		ct, err = s.db.Exec(ctx, `DELETE FROM api_tokens WHERE id = $1`, tokenID)
	} else {
		ct, err = s.db.Exec(ctx, `DELETE FROM api_tokens WHERE id = $1 AND subject = $2`, tokenID, subject)
	}
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
