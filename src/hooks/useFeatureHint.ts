import { useState, useEffect, useRef } from 'react';
import { storage } from '#/storage/mmkv';
import { useShowTutorials } from '#hooks/settings/useSettings';
import { useUserId } from '#store/useAppStore';
import { useStore } from '#store/index';
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
  /** Whether to show the hint immediately on mount (if not previously shown) */
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
 * Reusable hook for managing feature hints with MMKV persistence
 *
 * Returns `{ isVisible, hasBeenShown, actions }` where `actions` is a stable
 * object (reference never changes) containing `show`, `dismiss`, `hide`, `reset`.
 * Consumers should use `hint.actions` in effect deps instead of individual
 * callbacks to avoid re-triggers when visibility state changes.
 *
 * Storage keys are scoped per-account, so each user gets independent hint
 * state — logging in with a different account resets the tutorials for that
 * account.
 *
 * @example
 * const swipeHint = useFeatureHint({
 *   featureId: 'shopping_list_swipe',
 *   showOnMount: true,
 *   delay: 1000,
 * });
 *
 * // In effects — use actions (stable reference)
 * useEffect(() => {
 *   if (ready) swipeHint.actions.show();
 * }, [ready, swipeHint.actions]);
 *
 * // In JSX — use top-level state
 * return (
 *   <>
 *     {swipeHint.isVisible && (
 *       <FeatureHintOverlay onDismiss={swipeHint.actions.dismiss} />
 *     )}
 *   </>
 * );
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
 * Check if a specific feature hint has been shown
 */
export const hasFeatureHintBeenShown = (
  featureId: string,
  userId?: string,
): boolean => {
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

/**
 * Reset a feature hint (will show again next time)
 */
export const resetFeatureHint = (featureId: string, userId?: string): void => {
  storage.remove(buildStorageKey(userId, featureId));
};

/**
 * Reset all feature hints (useful for debugging or settings)
 * Clears all hints regardless of user prefix.
 */
export const resetAllFeatureHints = (): void => {
  const allKeys = storage.getAllKeys();
  allKeys.forEach(key => {
    if (key.startsWith(FEATURE_HINT_PREFIX)) {
      storage.remove(key);
    }
  });
  // Ensure tutorials-enabled is immediately consistent for hooks that re-read MMKV
  // (the GraphQL → MMKV sync is async via useEffect, so set it synchronously here)
  storage.set('user_show_tutorials', true);
  // Signal all mounted tutorial hooks to re-read from MMKV
  useStore.getState().bumpTutorialResetGeneration();
};

// --- Login count tracking (used to space out post-login modals) ---

const LOGIN_COUNT_PREFIX = 'login_count_';

export const getLoginCount = (userId: string): number => {
  return storage.getNumber(`${LOGIN_COUNT_PREFIX}${userId}`) ?? 0;
};

export const incrementLoginCount = (userId: string): void => {
  const key = `${LOGIN_COUNT_PREFIX}${userId}`;
  storage.set(key, (storage.getNumber(key) ?? 0) + 1);
};
