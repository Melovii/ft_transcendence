BEGIN;

CREATE TABLE outbox_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id BIGINT NOT NULL,
    event_type TEXT NOT NULL,
    outbox_content JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    room_version BIGINT NOT NULL
);

CREATE INDEX idx_outbox_events_pending
    ON outbox_events (room_id, room_version)
    WHERE published_at IS NULL;

CREATE TABLE command_ledger (
    room_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    request_id VARCHAR(64) NOT NULL,
    command_hash TEXT NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (room_id, session_id, request_id),

    CONSTRAINT chk_command_ledger_request_id CHECK (request_id ~ '^[!-~]{1,64}$')
);

CoMMIT;