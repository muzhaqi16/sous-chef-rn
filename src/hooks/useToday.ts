import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { toDateKey } from '#/utils/dateUtils';

const listeners = new Set<() => void>();
let stopWatching: (() => void) | null = null;

const notify = () => listeners.forEach(listener => listener());

/** One midnight timer and one AppState listener, however many readers. */
const startWatching = () => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const armForMidnight = () => {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    // Re-armed on every firing, not only on a change: one that lands a moment
    // early, or before a new zone's midnight, would otherwise be the last.
    timer = setTimeout(() => {
      notify();
      armForMidnight();
    }, nextMidnight.getTime() - now.getTime());
  };
  armForMidnight();
  // A backgrounded timer may not have fired.
  const subscription = AppState.addEventListener('change', state => {
    if (state === 'active') notify();
  });
  return () => {
    clearTimeout(timer);
    subscription.remove();
  };
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  stopWatching ??= startWatching();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopWatching?.();
      stopWatching = null;
    }
  };
};

const getSnapshot = () => toDateKey(new Date());

/**
 * The phone's calendar date as a `LocalDate` key: the one `today` the expiry
 * badge, lists and rows read, so they cannot disagree. A compiled component
 * that reads the clock itself keeps the day it first rendered on.
 */
export const useToday = (): string =>
  useSyncExternalStore(subscribe, getSnapshot);
