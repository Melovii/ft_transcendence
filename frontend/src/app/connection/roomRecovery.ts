/**
 * What the client does while the room socket is down.
 *
 * The socket itself keeps retrying with backoff (`ManagedSocket`) and a successful retry
 * brings a fresh `room.state` snapshot (`RoomConnection`). This controller adds what the
 * socket cannot see:
 *
 * - **The seat's deadline.** A drop from a live room starts the server's grace period. The
 *   client counts the same period from its own drop, publishes the deadline for the
 *   Reconnecting overlay, and gives up when it passes: by then the server has removed the
 *   member. On a match result the deadline is the result's own, which a drop never extends.
 * - **Why a handshake fails.** A browser is never told the HTTP status of a refused
 *   WebSocket upgrade, so a room that is gone, a membership that ended and an expired
 *   access cookie all look like a network drop. While the socket retries, a REST room
 *   snapshot tells them apart, at most once per `probeIntervalMs`. Its `401` also runs the
 *   REST client's silent refresh, which is how the contract renews the cookie the next
 *   handshake needs.
 * - **A first connection that never succeeds.** It stops after `firstConnectTimeoutMs`,
 *   so the room offers Try again instead of loading forever.
 *
 * The REST snapshot is only a check. The state the room is rebuilt from is always the
 * socket's own `room.state`, so events and the snapshot stay in one ordered stream.
 */

import { getRoomSnapshot } from '@features/room/api';
import { ApiError } from '@shared/api';
import { GRACE_PERIOD_MS, RECONNECT } from '@shared/constants';
import type { RoomRecovery as RoomRecoveryState } from '@shared/stores';
import type { RoomStatus } from '@shared/types';
import type { ConnectionCloseReason, ConnectionStatus } from '@shared/websocket';

export interface RoomRecoveryOptions {
  roomId: number;
  /** The signed-in player. */
  userId: () => number | undefined;
  /** The room's status as the client last saw it. */
  roomStatus: () => RoomStatus | undefined;
  /**
   * When this player's result decision runs out, on this device's clock, or `null` when
   * they are not on a result. A drop never extends it, so it replaces the grace period.
   */
  postGameDeadline: () => number | null;
  /** Stop the connection for a reason the socket could not report itself. */
  close: (reason: ConnectionCloseReason) => void;
  /** The recovery in progress, or `null` when there is none. */
  onRecovery: (recovery: RoomRecoveryState | null) => void;
  /** The room could not be restored: the seat's time ran out or the member was removed. */
  onLost: () => void;
}

function gracePeriodFor(status: RoomStatus): number {
  return status === 'IN_GAME' ? GRACE_PERIOD_MS.game : GRACE_PERIOD_MS.room;
}

export class RoomRecovery {
  private readonly options: RoomRecoveryOptions;
  /** A snapshot has been received on this connection at least once. */
  private synced = false;
  private recovering = false;
  private deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  private firstConnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastProbeAt = 0;
  private probing = false;
  private disposed = false;

  constructor(options: RoomRecoveryOptions) {
    this.options = options;
  }

  /** Feed every status the room connection reports. */
  handleStatus(status: ConnectionStatus, reason?: ConnectionCloseReason): void {
    if (this.disposed) return;

    if (status === 'OPEN') {
      this.synced = true;
      this.stop();
      return;
    }

    if (status === 'CLOSED' || status === 'IDLE') {
      // A closed room is the room page's to explain; a later Try again starts over.
      this.synced = false;
      this.stop();
      return;
    }

    if (this.synced) this.startRecovery();
    else this.startFirstConnect();

    // A failed attempt: find out whether retrying can still work.
    if (reason === 'TRANSPORT_DROP') void this.probe();
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
  }

  private startRecovery(): void {
    if (this.recovering) return;
    this.recovering = true;
    const postGame = this.options.postGameDeadline();
    const roomStatus = postGame !== null ? 'POST_GAME' : (this.options.roomStatus() ?? 'WAITING');
    const deadline = postGame ?? Date.now() + gracePeriodFor(roomStatus);
    this.options.onRecovery({ deadline, roomStatus });
    this.deadlineTimer = setTimeout(() => this.lose(), deadline - Date.now());
  }

  private startFirstConnect(): void {
    if (this.firstConnectTimer !== null) return;
    this.firstConnectTimer = setTimeout(() => {
      this.firstConnectTimer = null;
      this.options.close('UNKNOWN');
    }, RECONNECT.firstConnectTimeoutMs);
  }

  private async probe(): Promise<void> {
    const now = Date.now();
    if (this.probing || now - this.lastProbeAt < RECONNECT.probeIntervalMs) return;
    this.probing = true;
    this.lastProbeAt = now;
    try {
      const room = await getRoomSnapshot(this.options.roomId);
      if (!this.active()) return;
      const userId = this.options.userId();
      if (room.status === 'CLOSED') this.options.close('ROOM_NOT_FOUND');
      else if (!room.players.some((p) => p.user_id === userId)) this.removed();
      // Otherwise the seat is still there and the socket keeps retrying.
    } catch (error) {
      if (!this.active() || !(error instanceof ApiError)) return;
      if (error.code === 'ROOM_NOT_FOUND') this.options.close('ROOM_NOT_FOUND');
      else if (error.code === 'NOT_ROOM_MEMBER') this.removed();
      // The silent refresh failed too: the session is over, not the connection.
      else if (error.status === 401) this.options.close('SESSION_INVALID');
      // A network error or an unavailable service: keep retrying until the deadline.
    } finally {
      this.probing = false;
    }
  }

  /** The member is gone: after a drop that is the lost room, before one it is a refusal. */
  private removed(): void {
    if (this.synced) this.lose();
    else this.options.close('NOT_ROOM_MEMBER');
  }

  private lose(): void {
    if (!this.active()) return;
    this.stop();
    this.options.onLost();
  }

  private active(): boolean {
    return !this.disposed && (this.recovering || this.firstConnectTimer !== null);
  }

  private stop(): void {
    if (this.deadlineTimer !== null) clearTimeout(this.deadlineTimer);
    if (this.firstConnectTimer !== null) clearTimeout(this.firstConnectTimer);
    this.deadlineTimer = null;
    this.firstConnectTimer = null;
    if (this.recovering) {
      this.recovering = false;
      this.options.onRecovery(null);
    }
  }
}
