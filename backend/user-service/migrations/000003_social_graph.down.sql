DROP TABLE users.blocks;
DROP FUNCTION users.blocks_apply();
DROP FUNCTION users.blocks_release();
DROP TABLE users.friend_requests;
DROP FUNCTION users.friend_requests_guard();
DROP TABLE users.friendships;
DROP FUNCTION users.friendships_lock_pair();
DROP FUNCTION users.lock_user_pair(BIGINT, BIGINT);
