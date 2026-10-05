import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import {
  StyleSheet,
  UnistyleDependency,
  UnistylesRuntime,
} from 'react-native-unistyles';

let epoch = 0;
let watching = false;
const listeners = new Set<() => void>();

/** One Unistyles listener, started by the first reader. It runs after each commit lands. */
const watchThemeCommits = () => {
  if (watching) return;
  watching = true;
  StyleSheet.addChangeListener(dependencies => {
    if (!dependencies.includes(UnistyleDependency.Theme)) return;
    epoch += 1;
    listeners.forEach(listener => listener());
  });
};

const subscribe = (listener: () => void) => {
  watchThemeCommits();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getEpoch = () => epoch;

/** Bumps after every theme commit Unistyles makes. */
export const useThemeEpoch = () => useSyncExternalStore(subscribe, getEpoch);

let resyncQueued = false;

/** Re-registering the current theme replays a theme change to every Unistyles listener. */
const resyncThemeListeners = () => {
  if (resyncQueued) return;
  resyncQueued = true;
  queueMicrotask(() => {
    resyncQueued = false;
    const themeName = UnistylesRuntime.themeName;
    if (themeName) UnistylesRuntime.updateTheme(themeName, theme => theme);
  });
};

/**
 * `withUnistyles` and `useUnistyles` drop their listener while a paused screen
 * is hidden and never catch up when they re-subscribe, so a reveal that follows
 * a theme change replays it.
 */
export const useThemeResyncOnReveal = () => {
  const pausedAtEpoch = useRef<number | null>(null);

  useLayoutEffect(() => {
    watchThemeCommits();
    if (pausedAtEpoch.current !== null && pausedAtEpoch.current !== epoch) {
      resyncThemeListeners();
    }
    pausedAtEpoch.current = null;
    return () => {
      pausedAtEpoch.current = epoch;
    };
  }, []);
};
