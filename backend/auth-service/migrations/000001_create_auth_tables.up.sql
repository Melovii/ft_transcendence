BEGIN;

CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL CHECK (email <> '' AND email = btrim(email)),
    username TEXT NOT NULL CHECK (username ~ '^[A-Za-z0-9_]{3,20}$'),
    password_hash TEXT NOT NULL CHECK (password_hash <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
CREATE UNIQUE INDEX users_username_unique ON users (lower(username));

CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE CHECK (token_hash <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > created_at),
    rotated_at TIMESTAMPTZ,
    replaced_by UUID,
    revoked_at TIMESTAMPTZ,
    UNIQUE (session_id, id),
    CONSTRAINT refresh_tokens_replacement_fk
        FOREIGN KEY (session_id, replaced_by)
        REFERENCES refresh_tokens (session_id, id)
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT refresh_tokens_rotation_check CHECK (
        (rotated_at IS NULL AND replaced_by IS NULL)
        OR (rotated_at IS NOT NULL AND replaced_by IS NOT NULL AND revoked_at IS NOT NULL)
    ),
    CHECK (replaced_by IS NULL OR replaced_by <> id)
);

CREATE INDEX refresh_tokens_session_id_idx ON refresh_tokens (session_id);
CREATE INDEX refresh_tokens_expires_at_idx ON refresh_tokens (expires_at);

-- Retain rotated rows until expiry for reuse detection. Remove predecessors
-- together with a referenced replacement, or remove the expired session family.
-- The service updates users.updated_at when changing account data.

COMMIT;
