-- Profiles: one row per Auth user. Auth assigns user_id; User Service never
-- creates ids. There is no foreign key to the auth database, only the stable id.

-- Keeps updated_at honest on every UPDATE. Reused by later tables.
CREATE FUNCTION users.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$;

CREATE TABLE users.profiles (
    user_id     BIGINT      PRIMARY KEY,
    username    TEXT        NOT NULL,
    -- 'default' has no reference (the image is derived from user_id).
    -- 'preset' holds a preset id. 'upload' holds the stored file key.
    avatar_kind TEXT        NOT NULL DEFAULT 'default',
    avatar_ref  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT profiles_user_id_positive CHECK (user_id > 0),
    CONSTRAINT profiles_username_not_blank CHECK (btrim(username) <> ''),
    CONSTRAINT profiles_username_length CHECK (char_length(btrim(username)) BETWEEN 3 AND 20),
    CONSTRAINT profiles_username_chars CHECK (btrim(username) ~ '^[A-Za-z0-9_]+$'),
    CONSTRAINT profiles_avatar_kind_valid CHECK (avatar_kind IN ('default', 'preset', 'upload')),
    CONSTRAINT profiles_avatar_ref_matches_kind CHECK (
        (avatar_kind = 'default' AND avatar_ref IS NULL)
        OR (avatar_kind <> 'default' AND avatar_ref IS NOT NULL
            AND char_length(avatar_ref) BETWEEN 1 AND 255)
    )
);

-- Case-insensitive, whitespace-insensitive uniqueness. "Alice", "alice" and
-- " ALICE " all map to the same key, so only one of them can exist.
CREATE UNIQUE INDEX profiles_username_key ON users.profiles (lower(btrim(username)));

CREATE TRIGGER profiles_set_updated_at
    BEFORE UPDATE ON users.profiles
    FOR EACH ROW EXECUTE FUNCTION users.set_updated_at();
