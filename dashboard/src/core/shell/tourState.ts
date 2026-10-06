/**
 * The welcome tour: shown once per person on each browser (it's a convenience, so it lives in the browser rather than
 * the database), and again any time from the account menu or Admin > Help.
 */
const key = (userId: string) => `teamhub-tour-seen:${userId}`;

export function tourSeen(userId: string): boolean {
  try {
    return localStorage.getItem(key(userId)) === '1';
  } catch {
    return true; // storage blocked (private mode): don't keep showing it
  }
}

export function markTourSeen(userId: string) {
  try {
    localStorage.setItem(key(userId), '1');
  } catch {
    /* storage blocked */
  }
}

const EVENT = 'teamhub:tour';
export const openTour = () => window.dispatchEvent(new Event(EVENT));
export function onOpenTour(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
