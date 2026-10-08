/**
 * Joins Tailwind class values into one `class` string, dropping anything falsy. Keeps
 * conditional classes readable at the call site without a runtime dependency.
 */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
