/**
 * `event_id` gap detection for the room stream.
 *
 * The contract guarantees `event_id` is unique and monotonically ordered within one
 * room stream, but does not fix its lexical format. So this tracker only reports
 * *whether the stream restarted or moved backwards*, and the recovery path is always
 * the same one the contract prescribes: take a fresh `room.state` snapshot and discard
 * local state. Never replay history.
 */
export class EventOrderTracker {
  private lastEventId: string | null = null;

  /** Returns `true` when the event continues the stream, `false` when a gap is suspected. */
  accept(eventId: string): boolean {
    const previous = this.lastEventId;
    this.lastEventId = eventId;
    if (previous === null) return true;
    // Monotonic ordering means a later event never sorts before an earlier one.
    return eventId > previous;
  }

  /** Call on (re)connect, before the fresh snapshot arrives. */
  reset(): void {
    this.lastEventId = null;
  }

  get last(): string | null {
    return this.lastEventId;
  }
}
