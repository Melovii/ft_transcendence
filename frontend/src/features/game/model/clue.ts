/**
 * The clue rule from the contract: after trimming, one word of 1..30 characters with no
 * whitespace, and a number from 1 through 9. The form uses it only to enable Give Clue;
 * the server validates and normalizes the clue itself.
 */

export const CLUE_NUMBER = { min: 1, max: 9 } as const;

const CLUE_MAX_LENGTH = 30;

export function isOneWordClue(trimmed: string): boolean {
  const length = [...trimmed].length;
  return length >= 1 && length <= CLUE_MAX_LENGTH && !/\s/u.test(trimmed);
}
