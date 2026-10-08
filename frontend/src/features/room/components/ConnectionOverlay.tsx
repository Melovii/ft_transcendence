import { useEffect, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import disconnectedBadge from '@assets/connection/disconnected-badge.svg';
import { RECONNECT, ROUTES } from '@shared/constants';
import { useFocusTrap, useScrollLock } from '@shared/hooks';
import { useConnectionStore } from '@shared/stores';
import type { RoomRecovery } from '@shared/stores';
import type { RoomStatus } from '@shared/types';
import { Button, Dialog, LoadingDots } from '@shared/ui';

import { useLeaveRoom } from '../hooks/useLeaveRoom';
import * as styles from './ConnectionOverlay.styles';

/** The copy that fits what the player stands to lose: a match, a seat, or a result. */
function recoveryKind(status: RoomStatus): 'game' | 'room' | 'finished' {
  if (status === 'IN_GAME') return 'game';
  if (status === 'POST_GAME') return 'finished';
  return 'room';
}

/** `true` once `active` has held for `delayMs`; `false` as soon as it stops. */
function useDelayed(active: boolean, delayMs: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => {
      clearTimeout(timer);
      setShown(false);
    };
  }, [active, delayMs]);
  return active && shown;
}

/** Whole seconds until `deadline`, counted down once a second. */
function useSecondsLeft(deadline: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.ceil((deadline - now) / 1_000));
}

/**
 * Makes everything on the page except `ref` inert while it is mounted, so neither the
 * pointer, the keyboard nor assistive technology reaches the room behind the overlay —
 * including a dialog the room opens underneath it in the meantime.
 */
function useInertBackground(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const own = ref.current;
    const made = new Set<Element>();
    const makeInert = (element: Element) => {
      if (element === own || element.hasAttribute('inert')) return;
      element.setAttribute('inert', '');
      made.add(element);
    };
    [...document.body.children].forEach(makeInert);
    const observer = new MutationObserver((records) =>
      records.forEach((record) =>
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) makeInert(node);
        }),
      ),
    );
    observer.observe(document.body, { childList: true });
    return () => {
      observer.disconnect();
      made.forEach((element) => element.removeAttribute('inert'));
    };
  }, [ref]);
}

function ReconnectingCard({ recovery }: { recovery: RoomRecovery }) {
  const { t } = useTranslation();
  const titleId = useId();
  const bodyId = useId();
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const secondsLeft = useSecondsLeft(recovery.deadline);
  const leave = useLeaveRoom();
  const kind = recoveryKind(recovery.roomStatus);
  const leaving = leave.status === 'LEAVING';

  useInertBackground(backdropRef);
  useScrollLock();
  // Focus goes to the card, not to Leave: a key still held from the board must not leave.
  useFocusTrap(cardRef, true, 'container');

  return createPortal(
    <div ref={backdropRef} className={styles.backdrop}>
      <div
        ref={cardRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className={styles.card}
      >
        <span aria-hidden="true" className={styles.spinnerLarge}>
          <LoadingDots size="lg" />
        </span>
        <span aria-hidden="true" className={styles.spinnerSmall}>
          <LoadingDots size="md" />
        </span>
        <h2 id={titleId} className={styles.title}>
          {t('room.connection.reconnecting')}
        </h2>
        <p id={bodyId} className={styles.body}>
          {t(`room.connection.reconnectingBody.${kind}`)}
        </p>
        {/* Counts down every second, so it is read on demand rather than announced. */}
        <p className={styles.chip}>
          {t(`room.connection.secondsLeft.${kind}`, { seconds: secondsLeft })}
        </p>
        {leave.status === 'FAILED' && (
          <p role="alert" className={styles.error}>
            {t('room.leave.failed')}
          </p>
        )}
        {/* Held with `aria-disabled` rather than `disabled`, so focus stays in the card. */}
        <Button
          theme="outline"
          sizeClassName={styles.leave}
          onClick={() => {
            if (!leaving) void leave.confirm();
          }}
          aria-disabled={leaving}
          aria-busy={leaving}
          className={styles.leavePlacement}
        >
          {t(leaving ? 'room.leave.leaving' : `room.connection.leave.${kind}`)}
        </Button>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Reconnecting overlay.
 *
 * The server reserves the seat for a grace period (30s in `WAITING`/`COUNTDOWN`, 60s
 * `IN_GAME`; on a match result, the result's own decision deadline), so a drop shows this
 * overlay over the room, which stays on screen behind it,
 * and the connection retries on its own — it does not bounce the user to the Lobby. The
 * chip counts down the seat's time from the drop; the server's own timer is the one that
 * decides. Recovery is always a fresh `room.state` snapshot, never an event replay, and
 * the overlay stays until that snapshot has been applied, so nothing can be pressed
 * against stale state. Leave gives the seat up now instead of waiting.
 *
 * A drop that recovers within a moment shows nothing; the room's controls stay locked
 * for it all the same.
 */
export function ConnectionOverlay() {
  const recovery = useConnectionStore((state) => state.room.recovery);
  const status = useConnectionStore((state) => state.room.status);
  const active = recovery !== null && (status === 'RECONNECTING' || status === 'CONNECTING');
  const shown = useDelayed(active, RECONNECT.overlayDelayMs);

  if (!shown || !recovery) return null;
  return <ReconnectingCard recovery={recovery} />;
}

/**
 * Disconnected notice, over Room Discovery. The room connection could not be restored in
 * time, so the room was left behind; this says so once, and Back to Lobby acknowledges it.
 * The session is untouched: the player is still signed in.
 */
export function DisconnectedNotice() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const roomLost = useConnectionStore((state) => state.roomLost);
  const setRoomLost = useConnectionStore((state) => state.setRoomLost);
  const titleId = useId();
  const bodyId = useId();

  if (!roomLost) return null;

  const dismiss = () => {
    setRoomLost(false);
    navigate(ROUTES.lobby, { replace: true });
  };

  return (
    <Dialog
      role="alertdialog"
      labelledBy={titleId}
      describedBy={bodyId}
      closeLabel={t('room.connection.backToLobby')}
      onClose={dismiss}
      showCloseButton={false}
      className={styles.card}
    >
      <img src={disconnectedBadge} alt="" className={styles.badge} />
      <h2 id={titleId} className={styles.title}>
        {t('room.connection.lostTitle')}
      </h2>
      <p id={bodyId} className={styles.body}>
        {t('room.connection.lostBody')}
      </p>
      <Button
        sizeClassName={styles.backToLobby}
        onClick={dismiss}
        className={styles.backToLobbyWidth}
      >
        {t('room.connection.backToLobby')}
      </Button>
    </Dialog>
  );
}
