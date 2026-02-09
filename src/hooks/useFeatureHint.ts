import { useState, useEffect, useCallback, useMemo } from 'react';
import { storage } from '#/storage/mmkv';
import { useShowTutorials } from '#hooks/settings/useSettings';
import { useStableRef } from '#/hooks/utils/useStableRef';
import { useAppStore } from '#store/useAppStore';

const FEATURE_HINT_PREFIX = 'feature_hint_shown_';

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
 * Storage keys are scoped per-user when a user is logged in, so different users
 * on the same device get independent hint state.
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
  // Per-user storage key scoping
  const userId = useAppStore(state => state.user?.id);
  const storageKey = userId
    ? `${FEATURE_HINT_PREFIX}${userId}_${featureId}`
    : `${FEATURE_HINT_PREFIX}${featureId}`;

  // Check global showTutorials setting
  const tutorialsEnabled = useShowTutorials();
  const tutorialsEnabledRef = useStableRef(tutorialsEnabled);

  // Check if hint has been shown before (reactive state so dismiss updates immediately)
  const [hasBeenShown, setHasBeenShown] = useState(
    () => storage.getBoolean(storageKey) ?? false,
  );

  const [isVisible, setIsVisible] = useState(false);

  // Show hint on mount if configured, not shown before, and tutorials are enabled globally
  useEffect(() => {
    if (showOnMount && !hasBeenShown && tutorialsEnabled) {
      if (delay > 0) {
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, delay);
        return () => clearTimeout(timer);
      } else {
        setIsVisible(true);
      }
    }
  }, [showOnMount, hasBeenShown, delay, tutorialsEnabled]);

  const show = useCallback(() => {
    // Only show if tutorials are enabled globally and hint hasn't been dismissed
    if (tutorialsEnabledRef.current && !(storage.getBoolean(storageKey) ?? false)) {
      setIsVisible(true);
    }
  }, [tutorialsEnabledRef, storageKey]);

  const hide = useCallback(() => {
    setIsVisible(false);
  }, []);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    setHasBeenShown(true);
    storage.set(storageKey, true);
  }, [storageKey]);

  const reset = useCallback(() => {
    storage.remove(storageKey);
    setHasBeenShown(false);
    setIsVisible(false);
  }, [storageKey]);

  // Stable actions object — all callbacks are stable useCallbacks,
  // so this object reference is created once and never changes
  const actions = useMemo<UseFeatureHintActions>(
    () => ({ show, dismiss, hide, reset }),
    [show, dismiss, hide, reset],
  );

  return { isVisible, hasBeenShown, actions };
};

/**
 * Check if a specific feature hint has been shown
 */
export const hasFeatureHintBeenShown = (
  featureId: string,
  userId?: string,
): boolean => {
  const storageKey = userId
    ? `${FEATURE_HINT_PREFIX}${userId}_${featureId}`
    : `${FEATURE_HINT_PREFIX}${featureId}`;
  return storage.getBoolean(storageKey) ?? false;
};

/**
 * Mark a feature hint as shown without displaying it
 */
export const markFeatureHintAsShown = (
  featureId: string,
  userId?: string,
): void => {
  const storageKey = userId
    ? `${FEATURE_HINT_PREFIX}${userId}_${featureId}`
    : `${FEATURE_HINT_PREFIX}${featureId}`;
  storage.set(storageKey, true);
};

/**
 * Reset a feature hint (will show again next time)
 */
export const resetFeatureHint = (
  featureId: string,
  userId?: string,
): void => {
  const storageKey = userId
    ? `${FEATURE_HINT_PREFIX}${userId}_${featureId}`
    : `${FEATURE_HINT_PREFIX}${featureId}`;
  storage.remove(storageKey);
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
};
