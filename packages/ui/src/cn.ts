/** Joins class names, skipping falsy values. (No tailwind-merge: keep the bundle small and avoid conflicting classes.) */
export function cn(...parts: (string | false | null | undefined | 0)[]): string {
  return parts.filter(Boolean).join(' ');
}
