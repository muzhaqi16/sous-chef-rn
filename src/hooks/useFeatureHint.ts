import { useState, useEffect, useCallback, useMemo } from 'react';
import { storage } from '#/storage/mmkv';
import { useShowTutorials } from '#hooks/settings/useSettings';

const FEATURE_HINT_PREFIX = 'feature_hint_shown_';

export interface UseFeatureHintOptions {
  /** Unique identifier for this feature hint */
  featureId: string;
  /** Whether to show the hint immediately on mount (if not previously shown) */
  showOnMount?: boolean;
  /** Delay in milliseconds before showing the hint */
  delay?: number;
}

export interface UseFeatureHintReturn {
  /** Whether the hint should be visible */
  isVisible: boolean;
  /** Show the hint manually */
  show: () => void;
  /** Hide the hint and mark as shown */
  dismiss: () => void;
  /** Hide the hint without marking as shown (will show again next time) */
  hide: () => void;
  /** Check if hint has been shown before */
  hasBeenShown: boolean;
  /** Reset the hint (will show again next time) */
  reset: () => void;
}

/**
 * Reusable hook for managing feature hints with MMKV persistence
 *
 * @example
 * const swipeHint = useFeatureHint({
 *   featureId: 'shopping_list_swipe',
 *   showOnMount: true,
 *   delay: 1000,
 * });
 *
 * return (
 *   <>
 *     {swipeHint.isVisible && (
 *       <FeatureHintOverlay
 *         config={{
 *           title: 'Swipe left to mark as purchased',
 *           onDismiss: swipeHint.dismiss,
 *         }}
 *       />
 *     )}
 *   </>
 * );
 */
export const useFeatureHint = ({
  featureId,
  showOnMount = false,
  delay = 0,
}: UseFeatureHintOptions): UseFeatureHintReturn => {
  const storageKey = `${FEATURE_HINT_PREFIX}${featureId}`;

  // Check global showTutorials setting
  const tutorialsEnabled = useShowTutorials();

  // Check if hint has been shown before
  const hasBeenShown = storage.getBoolean(storageKey) ?? false;

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
    // Only show if tutorials are enabled globally
    if (tutorialsEnabled) {
      setIsVisible(true);
    }
  }, [tutorialsEnabled]);

  const hide = useCallback(() => {
    setIsVisible(false);
  }, []);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    storage.set(storageKey, true);
  }, [storageKey]);

  const reset = useCallback(() => {
    storage.remove(storageKey);
    setIsVisible(false);
  }, [storageKey]);

  return useMemo(
    () => ({
      isVisible,
      show,
      dismiss,
      hide,
      hasBeenShown,
      reset,
    }),
    [isVisible, show, dismiss, hide, hasBeenShown, reset],
  );
};

/**
 * Check if a specific feature hint has been shown
 */
export const hasFeatureHintBeenShown = (featureId: string): boolean => {
  const storageKey = `${FEATURE_HINT_PREFIX}${featureId}`;
  return storage.getBoolean(storageKey) ?? false;
};

/**
 * Mark a feature hint as shown without displaying it
 */
export const markFeatureHintAsShown = (featureId: string): void => {
  const storageKey = `${FEATURE_HINT_PREFIX}${featureId}`;
  storage.set(storageKey, true);
};

/**
 * Reset a feature hint (will show again next time)
 */
export const resetFeatureHint = (featureId: string): void => {
  const storageKey = `${FEATURE_HINT_PREFIX}${featureId}`;
  storage.remove(storageKey);
};

/**
 * Reset all feature hints (useful for debugging or settings)
 */
export const resetAllFeatureHints = (): void => {
  const allKeys = storage.getAllKeys();
  allKeys.forEach(key => {
    if (key.startsWith(FEATURE_HINT_PREFIX)) {
      storage.remove(key);
    }
  });
};
