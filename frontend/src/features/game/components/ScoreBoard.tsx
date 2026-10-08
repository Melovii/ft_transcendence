import { useTranslation } from 'react-i18next';

import type { Score } from '@shared/types';
import { Icon } from '@shared/ui';
import { cn } from '@shared/utils';

import * as styles from './ScoreBoard.styles';

/**
 * The live match score, as the server last reported it: revealed cards per team. The
 * desktop board hangs it as a tab from the top edge with each team's emblem; phones and
 * tablets show it as a pill at the head of the page.
 */
export function ScoreBoard({
  score,
  variant,
  className,
}: {
  score: Score;
  variant: 'tab' | 'pill';
  className?: string;
}) {
  const { t } = useTranslation();
  const s = styles[variant];

  return (
    <p className={cn(s.root, className)}>
      <span className="sr-only">{t('game.score.label', { red: score.red, blue: score.blue })}</span>
      <span aria-hidden="true" className={s.content}>
        {variant === 'tab' && <Icon name="settings" className={cn(s.icon, styles.redText)} />}
        <span className={cn(s.team, styles.redText)}>{t('game.team.RED')}</span>
        <span className={s.numbers}>
          <span>{score.red}</span>
          <span>—</span>
          <span>{score.blue}</span>
        </span>
        <span className={cn(s.team, styles.blueText)}>{t('game.team.BLUE')}</span>
        {variant === 'tab' && <Icon name="host" className={cn(s.icon, styles.blueText)} />}
      </span>
    </p>
  );
}
