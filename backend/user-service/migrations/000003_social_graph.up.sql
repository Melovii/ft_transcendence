-- Friendships, friend requests and blocks.
--
-- Unordered pairs: a pair of users is always stored as (user_low, user_high)
-- with user_low < user_high. (A, B) and (B, A) become the same key, so one
-- primary key or unique index covers both directions.
--
-- Foreign keys point only at users.profiles. Deleting a profile removes its
-- relationships.

-- Serializes work on one user pair for the length of a transaction. The
-- friend_requests and blocks triggers use it so checks that span two tables
-- cannot race.
CREATE FUNCTION users.lock_user_pair(a BIGINT, b BIGINT) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(
        hashtextextended('users.pair:' || LEAST(a, b) || ':' || GREATEST(a, b), 0));
END;
$$;

CREATE TABLE users.friendships (
    user_low     BIGINT      NOT NULL REFERENCES users.profiles (user_id) ON DELETE CASCADE,
    user_high    BIGINT      NOT NULL REFERENCES users.profiles (user_id) ON DELETE CASCADE,
    initiated_by BIGINT      NOT NULL,
    -- false means suspended by a block. The row is kept.
    active       BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_low, user_high),
    CONSTRAINT friendships_pair_ordered CHECK (user_low < user_high),
    CONSTRAINT friendships_initiator_in_pair CHECK (initiated_by IN (user_low, user_high))
);

CREATE INDEX friendships_user_high_idx ON users.friendships (user_high);

CREATE TRIGGER friendships_set_updated_at
    BEFORE UPDATE ON users.friendships
    FOR EACH ROW EXECUTE FUNCTION users.set_updated_at();

-- Takes the pair lock before a friendship appears or comes back to life.
CREATE FUNCTION users.friendships_lock_pair() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM users.lock_user_pair(NEW.user_low, NEW.user_high);
    RETURN NEW;
END;
$$;

CREATE TRIGGER friendships_lock_pair
    BEFORE INSERT OR UPDATE OF active ON users.friendships
    FOR EACH ROW EXECUTE FUNCTION users.friendships_lock_pair();

CREATE TABLE users.friend_requests (
    id           BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    requester_id BIGINT      NOT NULL REFERENCES users.profiles (user_id) ON DELETE CASCADE,
    addressee_id BIGINT      NOT NULL REFERENCES users.profiles (user_id) ON DELETE CASCADE,
    -- The database computes the normalized pair. Callers cannot get it wrong.
    user_low     BIGINT      GENERATED ALWAYS AS (LEAST(requester_id, addressee_id)) STORED,
    user_high    BIGINT      GENERATED ALWAYS AS (GREATEST(requester_id, addressee_id)) STORED,
    state        TEXT        NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at  TIMESTAMPTZ,

    CONSTRAINT friend_requests_not_self CHECK (requester_id <> addressee_id),
    CONSTRAINT friend_requests_state_valid CHECK (state IN ('pending', 'accepted', 'declined', 'cancelled')),
    CONSTRAINT friend_requests_resolved_matches_state CHECK ((state = 'pending') = (resolved_at IS NULL))
);

-- At most one pending request per unordered pair, whichever way it points.
-- Resolved requests stay as history and do not count.
CREATE UNIQUE INDEX friend_requests_one_pending_per_pair
    ON users.friend_requests (user_low, user_high) WHERE state = 'pending';
CREATE INDEX friend_requests_pending_requester_idx
    ON users.friend_requests (requester_id) WHERE state = 'pending';
CREATE INDEX friend_requests_pending_addressee_idx
    ON users.friend_requests (addressee_id) WHERE state = 'pending';

-- A pending request cannot exist next to an active friendship. The lock makes
-- this safe against a concurrent accept that creates the friendship.
-- The pair is computed here because generated columns are not filled in yet
-- when a BEFORE trigger runs.
-- Accepting must update the request first and insert the friendship after,
-- in one transaction.
CREATE FUNCTION users.friend_requests_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM users.lock_user_pair(NEW.requester_id, NEW.addressee_id);
    IF NEW.state = 'pending' AND EXISTS (
        SELECT 1 FROM users.friendships f
        WHERE f.user_low = LEAST(NEW.requester_id, NEW.addressee_id)
          AND f.user_high = GREATEST(NEW.requester_id, NEW.addressee_id)
          AND f.active
    ) THEN
        RAISE EXCEPTION 'users % and % are already friends', NEW.requester_id, NEW.addressee_id
            USING ERRCODE = 'check_violation', CONSTRAINT = 'friend_requests_no_active_friendship';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER friend_requests_guard
    BEFORE INSERT OR UPDATE OF state ON users.friend_requests
    FOR EACH ROW EXECUTE FUNCTION users.friend_requests_guard();

CREATE TABLE users.blocks (
    blocker_id BIGINT      NOT NULL REFERENCES users.profiles (user_id) ON DELETE CASCADE,
    blocked_id BIGINT      NOT NULL REFERENCES users.profiles (user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX blocks_blocked_idx ON users.blocks (blocked_id);

-- A new block suspends the friendship (kept, inactive) and cancels pending
-- requests, in the same transaction as the block itself.
CREATE FUNCTION users.blocks_apply() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_low  BIGINT := LEAST(NEW.blocker_id, NEW.blocked_id);
    v_high BIGINT := GREATEST(NEW.blocker_id, NEW.blocked_id);
BEGIN
    PERFORM users.lock_user_pair(v_low, v_high);
    UPDATE users.friendships SET active = false
    WHERE user_low = v_low AND user_high = v_high AND active;
    UPDATE users.friend_requests SET state = 'cancelled', resolved_at = clock_timestamp()
    WHERE user_low = v_low AND user_high = v_high AND state = 'pending';
    RETURN NULL;
END;
$$;

CREATE TRIGGER blocks_apply
    AFTER INSERT ON users.blocks
    FOR EACH ROW EXECUTE FUNCTION users.blocks_apply();

-- Lifting a block brings the friendship back only when nobody blocks anybody
-- in that pair any more. Cancelled requests stay cancelled. No friendship is
-- created here.
CREATE FUNCTION users.blocks_release() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_low  BIGINT := LEAST(OLD.blocker_id, OLD.blocked_id);
    v_high BIGINT := GREATEST(OLD.blocker_id, OLD.blocked_id);
BEGIN
    PERFORM users.lock_user_pair(v_low, v_high);
    UPDATE users.friendships f SET active = true
    WHERE f.user_low = v_low AND f.user_high = v_high AND NOT f.active
      AND NOT EXISTS (
          SELECT 1 FROM users.blocks b
          WHERE (b.blocker_id = v_low AND b.blocked_id = v_high)
             OR (b.blocker_id = v_high AND b.blocked_id = v_low)
      );
    RETURN NULL;
END;
$$;

CREATE TRIGGER blocks_release
    AFTER DELETE ON users.blocks
    FOR EACH ROW EXECUTE FUNCTION users.blocks_release();
