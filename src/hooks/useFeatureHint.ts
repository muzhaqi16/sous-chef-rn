import { useState, useEffect, useRef } from 'react';
import { storage } from '#/storage/mmkv';
import { useShowTutorials } from '#hooks/settings/useShowTutorials';
import { useUserId } from '#store/useAppStore';
import { useStore } from '#store';
import { useTutorialResetSignal } from '#hooks/ui/useTutorialResetSignal';

const FEATURE_HINT_PREFIX = 'feature_hint_shown_';

// Per-account: tutorials show once for each logged-in user. Switching to a
// different account resets the tutorial state for that account.
const buildStorageKey = (userId: string | undefined, featureId: string) =>
  userId
    ? `${FEATURE_HINT_PREFIX}${userId}_${featureId}`
    : `${FEATURE_HINT_PREFIX}${featureId}`;

export interface UseFeatureHintOptions {
  /** Unique identifier for this feature hint */
  featureId: string;
  /** Show the hint on mount, unless it has already been shown. */
  showOnMount?: boolean;
  /** Delay in milliseconds before showing the hint */
  delay?: number;
}

export interface UseFeatureHintActions {
  /** Show the hint manually */
  show: () => void;
  /** Hide the hint and mark as shown */
  dismiss: () => void;
  /** Hide the hint without marking as shown (will show again next time) */
  hide: () => void;
  /** Reset the hint (will show again next time) */
  reset: () => void;
}

export interface UseFeatureHintReturn {
  /** Whether the hint should be visible */
  isVisible: boolean;
  /** Check if hint has been shown before */
  hasBeenShown: boolean;
  /** Stable actions object — reference never changes */
  actions: UseFeatureHintActions;
}

/**
 * Feature hints, persisted in MMKV under PER-ACCOUNT keys, so each user has
 * independent hint state. `actions` has a stable identity — put it in effect
 * deps rather than the individual callbacks, or visibility changes re-trigger
 * the effect.
 */
export const useFeatureHint = ({
  featureId,
  showOnMount = false,
  delay = 0,
}: UseFeatureHintOptions): UseFeatureHintReturn => {
  const userId = useUserId();
  const storageKey = buildStorageKey(userId, featureId);

  // Check global showTutorials setting
  const tutorialsEnabled = useShowTutorials();

  // Check if hint has been shown before (reactive state so dismiss updates immediately)
  const [hasBeenShown, setHasBeenShown] = useState(
    () => storage.getBoolean(storageKey) ?? false,
  );

  // Initialize visibility: show immediately if showOnMount with no delay
  const [isVisible, setIsVisible] = useState(
    () => showOnMount && !hasBeenShown && tutorialsEnabled && delay === 0,
  );

  // React to external resets (centralized signal hook)
  const wasReset = useTutorialResetSignal();
  if (wasReset) {
    setHasBeenShown(storage.getBoolean(storageKey) ?? false);
    setIsVisible(false);
  }

  // Show hint with delay if configured, not shown before, and tutorials are enabled globally
  useEffect(() => {
    if (showOnMount && !hasBeenShown && tutorialsEnabled && delay > 0) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [showOnMount, hasBeenShown, delay, tutorialsEnabled]);

  // Refs for values used by actions — synced via effect so the compiler
  // sees actions as depending only on stable refs + setState, producing
  // a stable object reference automatically.
  const storageKeyRef = useRef(storageKey);
  const tutorialsEnabledRef = useRef(tutorialsEnabled);

  useEffect(() => {
    storageKeyRef.current = storageKey;
  }, [storageKey]);

  useEffect(() => {
    tutorialsEnabledRef.current = tutorialsEnabled;
  }, [tutorialsEnabled]);

  // Actions object — compiler memoizes this automatically since it only
  // depends on refs (stable identity) and setState fns (stable identity)
  const actions: UseFeatureHintActions = {
    show() {
      if (
        tutorialsEnabledRef.current &&
        !(storage.getBoolean(storageKeyRef.current) ?? false)
      ) {
        setIsVisible(true);
      }
    },
    hide() {
      setIsVisible(false);
    },
    dismiss() {
      setIsVisible(false);
      setHasBeenShown(true);
      storage.set(storageKeyRef.current, true);
    },
    reset() {
      storage.remove(storageKeyRef.current);
      setHasBeenShown(false);
      setIsVisible(false);
    },
  };

  return { isVisible, hasBeenShown, actions };
};

/**
 * Under Detox every hint reports as already shown: the overlay dims the screen
 * and swallows taps on a 2s delay, producing `View is not hittable` on every
 * tab. Deliberately NOT persisted — it suppresses display for this process only,
 * so a test that wants to assert the tutorial can still reset and drive it.
 */
let suppressedForE2E = false;

export const suppressFeatureHintsForE2E = (): void => {
  suppressedForE2E = true;
};

export const hasFeatureHintBeenShown = (
  featureId: string,
  userId?: string,
): boolean => {
  if (suppressedForE2E) return true;
  return storage.getBoolean(buildStorageKey(userId, featureId)) ?? false;
};

/**
 * Mark a feature hint as shown without displaying it
 */
export const markFeatureHintAsShown = (
  featureId: string,
  userId?: string,
): void => {
  storage.set(buildStorageKey(userId, featureId), true);
};

export const resetFeatureHint = (featureId: string, userId?: string): void => {
  storage.remove(buildStorageKey(userId, featureId));
};

/** Clears every hint, for all users. */
export const resetAllFeatureHints = (): void => {
  const allKeys = storage.getAllKeys();
  allKeys.forEach(key => {
    if (key.startsWith(FEATURE_HINT_PREFIX)) {
      storage.remove(key);
    }
  });
  // Set synchronously — the GraphQL → MMKV sync is async, and hooks re-read the
  // key the moment the generation below bumps.
  storage.set('user_show_tutorials', true);
  useStore.getState().bumpTutorialResetGeneration();
};

// Login count, for spacing out post-login modals.
const LOGIN_COUNT_PREFIX = 'login_count_';

export const getLoginCount = (userId: string): number => {
  return storage.getNumber(`${LOGIN_COUNT_PREFIX}${userId}`) ?? 0;
};

export const incrementLoginCount = (userId: string): void => {
  const key = `${LOGIN_COUNT_PREFIX}${userId}`;
  storage.set(key, (storage.getNumber(key) ?? 0) + 1);
};
