/**
 * `request_id` generator for WebSocket commands.
 *
 * The contract requires a unique string of 1..64 visible ASCII characters per session.
 * The server caches a request ID's result for the room lifetime, so a retry of the same
 * ID replays the original ack instead of repeating the mutation — reusing an ID with
 * different content is rejected as `INVALID_EVENT`.
 */
export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
