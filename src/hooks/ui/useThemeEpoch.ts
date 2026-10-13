import { useSyncExternalStore } from 'react';
import { StyleSheet, UnistyleDependency } from 'react-native-unistyles';

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
