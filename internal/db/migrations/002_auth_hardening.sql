-- Auth hardening: status columns, token expiry, LDAP subject namespace.

ALTER TABLE users ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'local';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_source_ck') THEN
    ALTER TABLE users ADD CONSTRAINT users_source_ck CHECK (source IN ('local', 'ldap'));
  END IF;
END$$;

ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

ALTER TABLE repo_members ADD COLUMN IF NOT EXISTS granted_by TEXT NOT NULL DEFAULT '';
ALTER TABLE repo_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE packages ADD COLUMN IF NOT EXISTS deleted_by TEXT NULL;

-- Session tokens carried a snapshot of is_admin and no expiry; force everyone to log in again.
DELETE FROM api_tokens WHERE token_type = 'session';

-- LDAP users were never stored in users and shared the bare-username namespace with
-- local accounts. Move them under the "ldap:" prefix. Only runs when LDAP was configured.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth_configs WHERE provider_type = 'ldap') THEN
    RETURN;
  END IF;

  CREATE TEMP TABLE ldap_subjects (subject TEXT PRIMARY KEY, active BOOLEAN NOT NULL) ON COMMIT DROP;

  -- "active" = evidence of a real login (token) or a publish.
  INSERT INTO ldap_subjects (subject, active)
  SELECT s.subject, bool_or(s.active)
  FROM (
    SELECT subject, FALSE AS active FROM repo_members
    UNION ALL
    SELECT subject, TRUE FROM api_tokens
    UNION ALL
    SELECT p.created_by, TRUE
      FROM packages p JOIN repositories r ON r.id = p.repo_id
     WHERE r.type = 'hosted'
    UNION ALL
    SELECT v.created_by, TRUE
      FROM versions v
      JOIN packages p ON p.id = v.package_id
      JOIN repositories r ON r.id = p.repo_id
     WHERE r.type = 'hosted'
  ) s
  WHERE s.subject <> ''
    AND s.subject <> '*'
    AND s.subject <> 'admin'
    AND position(':' IN s.subject) = 0
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.username = s.subject)
  GROUP BY s.subject;

  UPDATE repo_members SET subject = 'ldap:' || subject
   WHERE subject IN (SELECT subject FROM ldap_subjects);

  UPDATE api_tokens SET subject = 'ldap:' || subject
   WHERE subject IN (SELECT subject FROM ldap_subjects);

  UPDATE packages p SET created_by = 'ldap:' || p.created_by
    FROM repositories r
   WHERE r.id = p.repo_id AND r.type = 'hosted'
     AND p.created_by IN (SELECT subject FROM ldap_subjects);

  UPDATE versions v SET created_by = 'ldap:' || v.created_by
    FROM packages p JOIN repositories r ON r.id = p.repo_id
   WHERE p.id = v.package_id AND r.type = 'hosted'
     AND v.created_by IN (SELECT subject FROM ldap_subjects);

  INSERT INTO users (username, password_hash, display_name, source)
  SELECT 'ldap:' || subject, '', subject, 'ldap'
    FROM ldap_subjects
   WHERE active
  ON CONFLICT (username) DO NOTHING;
END$$;
