-- Durable workflow records and the transactional outbox. No foreign keys:
-- user_id is the Auth-assigned stable id, and a deletion record must survive
-- the profile it deletes.

-- Creates the profile for a new Auth user. The caller supplies operation_id as
-- the idempotency key, so a retried request finds the same row. Only one
-- provisioning exists per user.
-- States: pending, in_progress, completed, failed. failed means retryable.
CREATE TABLE users.provisioning_operations (
    operation_id UUID        PRIMARY KEY,
    user_id      BIGINT      NOT NULL,
    state        TEXT        NOT NULL DEFAULT 'pending',
    attempts     INTEGER     NOT NULL DEFAULT 0,
    last_error   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,

    CONSTRAINT provisioning_user_id_positive CHECK (user_id > 0),
    CONSTRAINT provisioning_state_valid CHECK (state IN ('pending', 'in_progress', 'completed', 'failed')),
    CONSTRAINT provisioning_attempts_nonnegative CHECK (attempts >= 0),
    CONSTRAINT provisioning_last_error_length CHECK (last_error IS NULL OR char_length(last_error) <= 2000),
    CONSTRAINT provisioning_completed_matches_state CHECK ((state = 'completed') = (completed_at IS NOT NULL))
);

CREATE UNIQUE INDEX provisioning_operations_user_key ON users.provisioning_operations (user_id);
-- The retry worker only looks at unfinished work.
CREATE INDEX provisioning_operations_unfinished_idx
    ON users.provisioning_operations (updated_at) WHERE state <> 'completed';

CREATE TRIGGER provisioning_operations_set_updated_at
    BEFORE UPDATE ON users.provisioning_operations
    FOR EACH ROW EXECUTE FUNCTION users.set_updated_at();

-- Account deletion coordinator. Same shape and rules as provisioning.
CREATE TABLE users.deletion_operations (
    operation_id UUID        PRIMARY KEY,
    user_id      BIGINT      NOT NULL,
    state        TEXT        NOT NULL DEFAULT 'pending',
    attempts     INTEGER     NOT NULL DEFAULT 0,
    last_error   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,

    CONSTRAINT deletion_user_id_positive CHECK (user_id > 0),
    CONSTRAINT deletion_state_valid CHECK (state IN ('pending', 'in_progress', 'completed', 'failed')),
    CONSTRAINT deletion_attempts_nonnegative CHECK (attempts >= 0),
    CONSTRAINT deletion_last_error_length CHECK (last_error IS NULL OR char_length(last_error) <= 2000),
    CONSTRAINT deletion_completed_matches_state CHECK ((state = 'completed') = (completed_at IS NOT NULL))
);

CREATE UNIQUE INDEX deletion_operations_user_key ON users.deletion_operations (user_id);
CREATE INDEX deletion_operations_unfinished_idx
    ON users.deletion_operations (updated_at) WHERE state <> 'completed';

CREATE TRIGGER deletion_operations_set_updated_at
    BEFORE UPDATE ON users.deletion_operations
    FOR EACH ROW EXECUTE FUNCTION users.set_updated_at();

-- Transactional outbox. Rows are written in the same transaction as the change
-- they describe. A publisher later sends them and sets published_at.
-- id order is publish order.
CREATE TABLE users.outbox (
    id             BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aggregate_type TEXT        NOT NULL,
    aggregate_id   TEXT        NOT NULL,
    event_type     TEXT        NOT NULL,
    payload        JSONB       NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at   TIMESTAMPTZ,
    attempts       INTEGER     NOT NULL DEFAULT 0,
    last_error     TEXT,

    CONSTRAINT outbox_aggregate_type_valid CHECK (btrim(aggregate_type) <> '' AND char_length(aggregate_type) <= 64),
    CONSTRAINT outbox_aggregate_id_valid CHECK (btrim(aggregate_id) <> '' AND char_length(aggregate_id) <= 128),
    CONSTRAINT outbox_event_type_valid CHECK (btrim(event_type) <> '' AND char_length(event_type) <= 128),
    CONSTRAINT outbox_payload_is_object CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT outbox_attempts_nonnegative CHECK (attempts >= 0),
    CONSTRAINT outbox_last_error_length CHECK (last_error IS NULL OR char_length(last_error) <= 2000)
);

-- Small and fast: only rows still waiting to be published.
CREATE INDEX outbox_unpublished_idx ON users.outbox (id) WHERE published_at IS NULL;
