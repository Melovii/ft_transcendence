BEGIN;

ALTER TABLE rooms DROP COLUMN last_game_id;

DROP TABLE game_history;
DROP TABLE game_cards;
DROP TABLE games;

COMMIT;
