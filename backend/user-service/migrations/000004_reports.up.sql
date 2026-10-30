-- Reports. No foreign keys: a report is a moderation record and should outlive
-- a deleted profile. The ids are stable ids, checked by the service.
CREATE TABLE users.reports (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporter_id BIGINT      NOT NULL,
    target_id   BIGINT      NOT NULL,
    reason      TEXT        NOT NULL,
    details     TEXT        NOT NULL DEFAULT '',
    -- Game room for context only. It belongs to another service, so no foreign key.
    room_id     BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT reports_reporter_positive CHECK (reporter_id > 0),
    CONSTRAINT reports_target_positive CHECK (target_id > 0),
    CONSTRAINT reports_not_self CHECK (reporter_id <> target_id),
    CONSTRAINT reports_reason_valid CHECK (reason IN ('harassment', 'cheating', 'offensive_username', 'spam', 'other')),
    CONSTRAINT reports_details_length CHECK (char_length(details) <= 500),
    CONSTRAINT reports_room_positive CHECK (room_id IS NULL OR room_id > 0)
);

-- Serves the "did this reporter report this target recently" lookup.
CREATE INDEX reports_reporter_target_recent_idx
    ON users.reports (reporter_id, target_id, created_at DESC);

-- One report per reporter and target inside a window.
-- A plain unique index cannot express a sliding window, so this function does
-- the check and the insert as one step under a lock for the (reporter, target)
-- pair. Two simultaneous calls cannot both insert.
--
-- Returns one row. When the report was stored, out_report_id is set and
-- retry_after_seconds is null. When the window is still open, out_report_id is
-- null and retry_after_seconds says how long to wait.
CREATE FUNCTION users.file_report(
    p_reporter_id BIGINT,
    p_target_id   BIGINT,
    p_reason      TEXT,
    p_details     TEXT,
    p_room_id     BIGINT,
    p_window      INTERVAL
) RETURNS TABLE (out_report_id BIGINT, out_created_at TIMESTAMPTZ, retry_after_seconds BIGINT)
LANGUAGE plpgsql AS $$
DECLARE
    v_last TIMESTAMPTZ;
BEGIN
    IF p_window <= INTERVAL '0' THEN
        RAISE EXCEPTION 'report window must be positive' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended('users.report:' || p_reporter_id || ':' || p_target_id, 0));

    SELECT max(r.created_at) INTO v_last
    FROM users.reports r
    WHERE r.reporter_id = p_reporter_id
      AND r.target_id = p_target_id
      AND r.created_at > clock_timestamp() - p_window;

    IF v_last IS NOT NULL THEN
        RETURN QUERY SELECT NULL::BIGINT, NULL::TIMESTAMPTZ,
            ceil(extract(epoch FROM (v_last + p_window - clock_timestamp())))::BIGINT;
        RETURN;
    END IF;

    RETURN QUERY
        INSERT INTO users.reports AS r (reporter_id, target_id, reason, details, room_id)
        VALUES (p_reporter_id, p_target_id, p_reason, p_details, p_room_id)
        RETURNING r.id, r.created_at, NULL::BIGINT;
END;
$$;
