package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	UserSourceLocal = "local"
	UserSourceLDAP  = "ldap"
)

type User struct {
	ID                uuid.UUID  `json:"id"`
	Username          string     `json:"username"`
	PasswordHash      string     `json:"-"`
	DisplayName       string     `json:"display_name"`
	Email             string     `json:"email"`
	IsAdmin           bool       `json:"is_admin"`
	Disabled          bool       `json:"disabled"`
	Source            string     `json:"source"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	LastLoginAt       *time.Time `json:"last_login_at"`
	PasswordChangedAt *time.Time `json:"password_changed_at"`
}

const userColumns = `id, username, password_hash, display_name, email, is_admin, disabled,
	source, created_at, updated_at, last_login_at, password_changed_at`

func scanUser(row pgx.Row) (User, error) {
	var u User
	err := row.Scan(
		&u.ID, &u.Username, &u.PasswordHash, &u.DisplayName, &u.Email, &u.IsAdmin, &u.Disabled,
		&u.Source, &u.CreatedAt, &u.UpdatedAt, &u.LastLoginAt, &u.PasswordChangedAt,
	)
	return u, err
}

// CreateUser inserts a local (password-based) account.
func (s *Store) CreateUser(ctx context.Context, username, passwordHash, displayName, email string, isAdmin bool) (User, error) {
	u, err := scanUser(s.db.QueryRow(ctx, `
		INSERT INTO users (username, password_hash, display_name, email, is_admin, source)
		VALUES ($1, $2, $3, $4, $5, 'local')
		RETURNING `+userColumns, username, passwordHash, displayName, email, isAdmin))
	if err != nil {
		if isUniqueViolation(err) {
			return User{}, ErrConflict
		}
		return User{}, err
	}
	return u, nil
}

// UpsertLDAPUser creates or refreshes the users row for an LDAP identity.
// Returns ErrConflict if the username is already taken by a non-LDAP account.
func (s *Store) UpsertLDAPUser(ctx context.Context, username, displayName, email string) (User, error) {
	u, err := scanUser(s.db.QueryRow(ctx, `
		INSERT INTO users (username, password_hash, display_name, email, source)
		VALUES ($1, '', $2, $3, 'ldap')
		ON CONFLICT (username) DO UPDATE
		SET display_name = EXCLUDED.display_name,
		    email = EXCLUDED.email,
		    updated_at = CASE
		      WHEN users.display_name IS DISTINCT FROM EXCLUDED.display_name
		        OR users.email IS DISTINCT FROM EXCLUDED.email THEN now()
		      ELSE users.updated_at END
		WHERE users.source = 'ldap'
		RETURNING `+userColumns, username, displayName, email))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrConflict
		}
		return User{}, err
	}
	return u, nil
}

// TouchUserLogin records a successful login.
func (s *Store) TouchUserLogin(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.Exec(ctx, `UPDATE users SET last_login_at = now() WHERE id = $1`, id)
	return err
}

func (s *Store) GetUserByUsername(ctx context.Context, username string) (User, error) {
	return scanUser(s.db.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE username = $1`, username))
}

func (s *Store) GetUserByID(ctx context.Context, id uuid.UUID) (User, error) {
	return scanUser(s.db.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id))
}

func (s *Store) ListUsers(ctx context.Context) ([]User, error) {
	rows, err := s.db.Query(ctx, `SELECT `+userColumns+` FROM users ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// UpdateUser updates profile and status. Disabling a user revokes all of
// their tokens in the same transaction.
func (s *Store) UpdateUser(ctx context.Context, id uuid.UUID, displayName, email string, isAdmin, disabled bool) (User, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	u, err := scanUser(tx.QueryRow(ctx, `
		UPDATE users
		SET display_name = $2, email = $3, is_admin = $4, disabled = $5, updated_at = now()
		WHERE id = $1
		RETURNING `+userColumns, id, displayName, email, isAdmin, disabled))
	if err != nil {
		return User{}, err
	}
	if disabled {
		if _, err := tx.Exec(ctx, `DELETE FROM api_tokens WHERE subject = $1`, u.Username); err != nil {
			return User{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return User{}, err
	}
	return u, nil
}

// UpdateUserPassword sets a new password hash and stamps password_changed_at,
// which invalidates session tokens issued earlier.
func (s *Store) UpdateUserPassword(ctx context.Context, id uuid.UUID, passwordHash string) error {
	ct, err := s.db.Exec(ctx, `
		UPDATE users
		SET password_hash = $2, password_changed_at = now(), updated_at = now()
		WHERE id = $1
	`, id, passwordHash)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// DeleteUser removes a user together with their tokens and repository roles.
func (s *Store) DeleteUser(ctx context.Context, id uuid.UUID) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var username string
	if err := tx.QueryRow(ctx, `DELETE FROM users WHERE id = $1 RETURNING username`, id).Scan(&username); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM api_tokens WHERE subject = $1`, username); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM repo_members WHERE subject = $1`, username); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
