import React, {
  createContext,
  useContext,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  AnimationDirection,
  ExitAnimationTrigger,
  PendingEntryAnimation,
} from '../types';

/**
 * Context value for coordinating entry/exit animations across list items.
 *
 * This enables:
 * 1. Direct O(1) animation triggers from subscription handlers
 * 2. Entry animation coordination when items appear in new locations
 * 3. Decoupled animation state from React render cycle
 */
export interface ListAnimationContextValue {
  /**
   * Register an exit animation trigger for an item.
   * Called by useListExitAnimation on mount.
   */
  registerAnimationTrigger: (itemId: string, trigger: ExitAnimationTrigger) => void;

  /**
   * Unregister an exit animation trigger.
   * Called by useListExitAnimation on unmount.
   */
  unregisterAnimationTrigger: (itemId: string) => void;

  /**
   * Trigger exit animation for a specific item.
   * Returns true if animation was triggered, false if item not found.
   */
  triggerExitAnimation: (
    itemId: string,
    direction: AnimationDirection,
    onComplete: () => void,
  ) => boolean;

  /**
   * Queue an entry animation for an item that's about to appear.
   * Call this before the item is added to the list.
   */
  queueEntryAnimation: (itemId: string, direction: AnimationDirection) => void;

  /**
   * Check and claim a pending entry animation for an item.
   * Returns the animation info if found, null otherwise.
   * Calling this consumes the pending animation.
   */
  claimEntryAnimation: (itemId: string) => PendingEntryAnimation | null;
}

const ListAnimationContext = createContext<ListAnimationContextValue | null>(null);

/**
 * Hook to access list animation context.
 * Throws if used outside ListAnimationProvider.
 */
export const useListAnimation = (): ListAnimationContextValue => {
  const context = useContext(ListAnimationContext);
  if (!context) {
    throw new Error('useListAnimation must be used within ListAnimationProvider');
  }
  return context;
};

/**
 * Hook to optionally access list animation context.
 * Returns null if used outside ListAnimationProvider.
 * Useful for components that can work with or without animations.
 */
export const useListAnimationOptional = (): ListAnimationContextValue | null => {
  return useContext(ListAnimationContext);
};

interface ListAnimationProviderProps {
  children: ReactNode;
  /**
   * How long pending entry animations are valid (ms)
   * @default 5000
   */
  entryAnimationTimeout?: number;
}

/**
 * Provider for coordinating entry/exit animations across list items.
 *
 * Features:
 * - O(1) exit animation triggers via Map lookup
 * - Entry animation queuing with automatic expiration
 * - Decoupled from React render cycle for performance
 */
export const ListAnimationProvider: React.FC<ListAnimationProviderProps> = ({
  children,
  entryAnimationTimeout = 5000,
}) => {
  // Map of itemId -> exit animation trigger function
  const animationTriggersRef = useRef<Map<string, ExitAnimationTrigger>>(new Map());

  // Map of itemId -> pending entry animation
  const pendingEntriesRef = useRef<Map<string, PendingEntryAnimation>>(new Map());

  const registerAnimationTrigger = useCallback(
    (itemId: string, trigger: ExitAnimationTrigger) => {
      animationTriggersRef.current.set(itemId, trigger);
    },
    [],
  );

  const unregisterAnimationTrigger = useCallback((itemId: string) => {
    animationTriggersRef.current.delete(itemId);
  }, []);

  const triggerExitAnimation = useCallback(
    (
      itemId: string,
      direction: AnimationDirection,
      onComplete: () => void,
    ): boolean => {
      const trigger = animationTriggersRef.current.get(itemId);
      if (trigger) {
        trigger(direction, onComplete);
        return true;
      }
      return false;
    },
    [],
  );

  const queueEntryAnimation = useCallback(
    (itemId: string, direction: AnimationDirection) => {
      const entry: PendingEntryAnimation = {
        itemId,
        direction,
        timestamp: Date.now(),
      };
      pendingEntriesRef.current.set(itemId, entry);

      // Auto-expire after timeout
      setTimeout(() => {
        const current = pendingEntriesRef.current.get(itemId);
        if (current && current.timestamp === entry.timestamp) {
          pendingEntriesRef.current.delete(itemId);
        }
      }, entryAnimationTimeout);
    },
    [entryAnimationTimeout],
  );

  const claimEntryAnimation = useCallback(
    (itemId: string): PendingEntryAnimation | null => {
      const entry = pendingEntriesRef.current.get(itemId);
      if (entry) {
        pendingEntriesRef.current.delete(itemId);
        // Check if still valid (not expired)
        if (Date.now() - entry.timestamp < entryAnimationTimeout) {
          return entry;
        }
      }
      return null;
    },
    [entryAnimationTimeout],
  );

  const value = useMemo<ListAnimationContextValue>(
    () => ({
      registerAnimationTrigger,
      unregisterAnimationTrigger,
      triggerExitAnimation,
      queueEntryAnimation,
      claimEntryAnimation,
    }),
    [
      registerAnimationTrigger,
      unregisterAnimationTrigger,
      triggerExitAnimation,
      queueEntryAnimation,
      claimEntryAnimation,
    ],
  );

  return (
    <ListAnimationContext.Provider value={value}>
      {children}
    </ListAnimationContext.Provider>
  );
};
