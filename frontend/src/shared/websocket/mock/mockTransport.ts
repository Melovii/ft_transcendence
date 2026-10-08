/**
 * In-memory `SocketTransport` used by the mock socket layer.
 *
 * It follows the same lifecycle as `ManagedSocket` — `CONNECTING` then `OPEN`,
 * `RECONNECTING` with the same backoff after a drop, `CLOSED` on disconnect — and hands
 * frames to the same `onMessage` callback, so the connection classes above it cannot tell
 * the difference.
 *
 * A reconnect attempt fails while the mock network is down, or when the server would
 * refuse the handshake (the session is not valid, or the member was removed). The browser is never told why a
 * handshake failed, so such an attempt looks like any other drop and the transport
 * simply tries again later, exactly like the real one.
 */

import { RECONNECT } from '@shared/constants';

import type { ConnectionCloseReason, ConnectionStatus } from '../connectionState';
import type { SocketTransport, TransportOptions } from '../transport';
import { mockNetwork, mockSession } from './registry';

/** What a mock server needs from one connected transport. */
export interface MockEndpoint {
  deliver(message: unknown): void;
  isOpen(): boolean;
  simulateDrop(reconnectAfterMs?: number): void;
  simulateClose(reason: ConnectionCloseReason): void;
}

export interface MockServerBinding {
  onOpen(endpoint: MockEndpoint): void;
  /** `dropped` is true when the connection was lost rather than closed by the client. */
  onClose(endpoint: MockEndpoint, dropped: boolean): void;
  onCommand(endpoint: MockEndpoint, message: unknown): void;
  /** Whether a handshake would succeed now. Missing means always. */
  accepts?(): boolean;
}

export class MockTransport<TInbound, TOutbound>
  implements SocketTransport<TOutbound>, MockEndpoint
{
  private status: ConnectionStatus = 'IDLE';
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly options: TransportOptions<TInbound>;
  private readonly server: MockServerBinding;

  constructor(options: TransportOptions<TInbound>, server: MockServerBinding) {
    this.options = options;
    this.server = server;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  connect(): void {
    if (this.status === 'OPEN' || this.status === 'CONNECTING') return;
    this.clearRetry();
    const opening = this.attempt === 0 ? 'CONNECTING' : 'RECONNECTING';
    if (this.status !== opening) this.setStatus(opening);
    queueMicrotask(() => {
      if (this.status !== 'CONNECTING' && this.status !== 'RECONNECTING') return;
      if (this.retryTimer !== null) return;
      if (!mockNetwork.online || !mockSession.authorized() || this.server.accepts?.() === false) {
        this.scheduleRetry();
        return;
      }
      this.attempt = 0;
      this.setStatus('OPEN');
      this.server.onOpen(this);
    });
  }

  disconnect(): void {
    const wasOpen = this.status === 'OPEN';
    this.clearRetry();
    this.attempt = 0;
    this.setStatus('CLOSED', 'CLIENT_DISCONNECT');
    if (wasOpen) this.server.onClose(this, false);
  }

  reconnect(): void {
    const wasOpen = this.status === 'OPEN';
    this.clearRetry();
    this.attempt = Math.max(this.attempt, 1);
    this.setStatus('RECONNECTING');
    if (wasOpen) this.server.onClose(this, false);
    this.connect();
  }

  send(message: TOutbound): boolean {
    if (this.status !== 'OPEN') return false;
    // Server replies arrive asynchronously, like real frames.
    queueMicrotask(() => this.server.onCommand(this, message));
    return true;
  }

  deliver(message: unknown): void {
    if (this.status !== 'OPEN') return;
    this.options.onMessage?.(structuredClone(message) as TInbound);
  }

  isOpen(): boolean {
    return this.status === 'OPEN';
  }

  /** Lose the connection; the first retry comes after `reconnectAfterMs`. */
  simulateDrop(reconnectAfterMs = 1_500): void {
    if (this.status !== 'OPEN') return;
    this.server.onClose(this, true);
    this.attempt = 1;
    this.setStatus('RECONNECTING', 'TRANSPORT_DROP');
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, reconnectAfterMs);
  }

  simulateClose(reason: ConnectionCloseReason): void {
    if (this.status !== 'OPEN') return;
    this.server.onClose(this, true);
    this.setStatus('CLOSED', reason);
  }

  /** The same backoff as `ManagedSocket`. */
  private scheduleRetry(): void {
    const { initialDelayMs, maxDelayMs } = RECONNECT;
    const delay = Math.min(initialDelayMs * 2 ** this.attempt, maxDelayMs);
    this.attempt += 1;
    this.setStatus('RECONNECTING', 'TRANSPORT_DROP');
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private setStatus(status: ConnectionStatus, reason?: ConnectionCloseReason): void {
    this.status = status;
    this.options.onStatusChange?.(status, reason);
  }
}
