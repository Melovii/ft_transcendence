/**
 * Domain primitives shared by the room and game contracts.
 *
 * They live in their own module so `room.ts` and `game.ts` can both use them without
 * importing each other.
 */

/** Teams are exactly these two. */
export type Team = 'RED' | 'BLUE';

/**
 * Revealed card counts per color. Either color may be the starting team that owns 9
 * cards, so both values independently range `0..9`.
 */
export interface Score {
  red: number;
  blue: number;
}
