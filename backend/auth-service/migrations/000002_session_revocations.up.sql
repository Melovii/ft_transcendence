BEGIN;

-- Keep notification delivery independent of session/account retention.
CREATE TABLE session_revocations (
    session_id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL,
    revoked_at TIMESTAMPTZ NOT NULL,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at TIMESTAMPTZ
);

CREATE INDEX session_revocations_pending_idx
    ON session_revocations (next_attempt_at, revoked_at, session_id)
    WHERE delivered_at IS NULL;

COMMIT;
