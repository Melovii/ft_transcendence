/**
 * The clue rule from the contract: after trimming, one word of 1..30 characters with no
 * whitespace that is not a word on the board, and a number from 1 through 9. The form uses
 * it only to enable Give Clue; the server validates the clue itself.
 */

export const CLUE_NUMBER = { min: 1, max: 9 } as const;

const CLUE_MAX_LENGTH = 30;

export function isOneWordClue(trimmed: string): boolean {
  const length = [...trimmed].length;
  return length >= 1 && length <= CLUE_MAX_LENGTH && !/\s/u.test(trimmed);
}

/** Whether the trimmed clue is a board word, compared case-insensitively as the server does. */
export function isBoardWord(trimmed: string, boardWords: readonly string[]): boolean {
  const clue = trimmed.toLowerCase();
  return boardWords.some((word) => word.toLowerCase() === clue);
}
