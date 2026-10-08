import { useEffect, useRef, useState } from 'react';

import cardPattern from '@assets/game/card-pattern.svg';
import assassinSkull from '@assets/game/assassin-skull.svg';
import type { CardColor } from '@shared/types';
import { cn } from '@shared/utils';

import * as styles from './WordCard.styles';

export interface WordCardProps {
  word: string;
  /**
   * The card's affiliation as the server sent it to this player: `null` while it is
   * hidden from them. A Spymaster receives it for every card, an Operative only once the
   * card is revealed.
   */
  color?: CardColor | null;
  revealed?: boolean;
  /** The card a pick is on its way for. */
  selected?: boolean;
  /** How strongly the card is drawn. */
  emphasis?: keyof typeof styles.emphasis;
  /** Makes the card a button that picks it. Omitted, the card is not interactive. */
  onSelect?: (() => void) | undefined;
  /** No pick is possible right now, though the card is a pickable one. */
  disabled?: boolean;
  /** Accessible name; defaults to the word. */
  label?: string | undefined;
  className?: string | undefined;
}

/**
 * One board tile.
 *
 * The face follows the color the server sent: a team, neutral or assassin face when there
 * is one, the patterned base face when there is none. The component never derives an
 * affiliation of its own. A card that turns revealed while on screen flips to its face;
 * the flip is decoration only and nothing waits for it.
 */
export function WordCard({
  word,
  color = null,
  revealed = false,
  selected = false,
  emphasis = 'full',
  onSelect,
  disabled = false,
  label,
  className,
}: WordCardProps) {
  const face: styles.WordCardFace = color ?? 'HIDDEN';
  const wasRevealed = useRef(revealed);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (revealed && !wasRevealed.current) setFlipping(true);
    wasRevealed.current = revealed;
  }, [revealed]);

  const content = (
    <>
      {styles.innerFaces[face] && (
        <span
          aria-hidden="true"
          className={cn(styles.inner, styles.innerFaces[face])}
          style={face === 'HIDDEN' ? { backgroundImage: `url(${cardPattern})` } : undefined}
        />
      )}
      {face === 'ASSASSIN' && (
        <img src={assassinSkull} alt="" aria-hidden="true" className={styles.skull} />
      )}
      <span aria-hidden={label ? true : undefined} className={styles.word}>
        {word}
      </span>
    </>
  );

  const classes = cn(
    styles.card,
    styles.faces[face],
    face === 'ASSASSIN' && styles.assassinLayout,
    styles.emphasis[emphasis],
    selected && styles.selected,
    flipping && styles.revealing,
    className,
  );

  if (!onSelect) {
    return (
      <div
        role={label ? 'img' : undefined}
        aria-label={label}
        className={classes}
        onAnimationEnd={() => setFlipping(false)}
      >
        {content}
      </div>
    );
  }

  const inert = disabled || revealed;
  return (
    <button
      type="button"
      onClick={inert ? undefined : onSelect}
      aria-disabled={inert || undefined}
      aria-pressed={selected || undefined}
      aria-label={label}
      className={cn(classes, !inert && styles.interactive, inert && 'cursor-default')}
      onAnimationEnd={() => setFlipping(false)}
    >
      {content}
    </button>
  );
}
