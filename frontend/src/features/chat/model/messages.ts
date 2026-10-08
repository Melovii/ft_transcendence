/**
 * Pure message rules: validation of a draft, the authoritative order of a conversation,
 * duplicate-free merging, and the day and age labels the panel shows.
 */

import { CHAT_MESSAGE_MAX_LENGTH } from '@shared/types';
import type { ChatMessage } from '@shared/types';

/** Length as the contract counts it: characters, not UTF-16 code units. */
export const messageLength = (text: string): number => Array.from(text).length;

/**
 * The text a draft would send: trimmed, or `null` when there is nothing to send or it is
 * over the contract's 500 characters. The server applies the same rule.
 */
export function sendableText(draft: string): string | null {
  const text = draft.trim();
  const length = messageLength(text);
  return length >= 1 && length <= CHAT_MESSAGE_MAX_LENGTH ? text : null;
}

/** Server time first, then `message_id`, so concurrent messages keep one stable order. */
export function compareMessages(a: ChatMessage, b: ChatMessage): number {
  const byTime = Date.parse(a.sent_at) - Date.parse(b.sent_at);
  if (byTime !== 0) return byTime;
  return a.message_id < b.message_id ? -1 : a.message_id > b.message_id ? 1 : 0;
}

/**
 * Merge messages into a conversation, oldest first. A message is identified by its
 * `message_id` only: the same message delivered twice (live and again in history after a
 * reconnect) appears once, while two different messages with the same text both stay.
 */
export function mergeMessages(
  existing: readonly ChatMessage[],
  incoming: readonly ChatMessage[],
): ChatMessage[] {
  if (incoming.length === 0) return existing as ChatMessage[];
  const byId = new Map(existing.map((m) => [m.message_id, m]));
  for (const message of incoming) byId.set(message.message_id, message);
  return [...byId.values()].sort(compareMessages);
}

/** The calendar day of a timestamp in the viewer's time zone, as `YYYY-M-D`. */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export type DayLabel = { kind: 'TODAY' } | { kind: 'YESTERDAY' } | { kind: 'DATE'; date: Date };

/** Which day divider a message falls under, relative to `now`. */
export function dayLabel(iso: string, now: Date = new Date()): DayLabel {
  const date = new Date(iso);
  const today = dayKey(now.toISOString());
  if (dayKey(iso) === today) return { kind: 'TODAY' };
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return { kind: 'YESTERDAY' };
  return { kind: 'DATE', date };
}

export type Age =
  | { unit: 'NOW' }
  | { unit: 'MINUTES' | 'HOURS' | 'DAYS'; count: number }
  | { unit: 'DATE'; date: Date };

/** How long ago a message was sent, in the conversation list's short form (`2m`, `1h`). */
export function messageAge(iso: string, now: number = Date.now()): Age {
  const minutes = Math.floor(Math.max(0, now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return { unit: 'NOW' };
  if (minutes < 60) return { unit: 'MINUTES', count: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: 'HOURS', count: hours };
  const days = Math.floor(hours / 24);
  if (days < 7) return { unit: 'DAYS', count: days };
  return { unit: 'DATE', date: new Date(iso) };
}
