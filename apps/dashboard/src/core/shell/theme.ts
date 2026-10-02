import { useEffect, useSyncExternalStore } from 'react';
import { runtime } from '@teamhub/sdk';

type Pref = 'light' | 'dark' | 'system';
const KEY = 'teamhub-theme';
const listeners = new Set<() => void>();

function read(): Pref {
  try {
    return (localStorage.getItem(KEY) as Pref) || runtime().config.theme.defaultMode;
  } catch {
    return 'system';
  }
}

function apply(pref: Pref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

/** Light / Dark / System per device (localStorage, no DB row, spec §9.2). */
export function useTheme() {
  const pref = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => 'system' as Pref,
  );
  useEffect(() => {
    apply(pref);
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => apply('system');
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [pref]);
  return {
    pref,
    setPref: (p: Pref) => {
      try {
        localStorage.setItem(KEY, p);
      } catch {}
      listeners.forEach((l) => l());
    },
  };
}
