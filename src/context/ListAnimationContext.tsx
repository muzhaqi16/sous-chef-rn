import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import type {
  AnimationDirection,
  ExitAnimationTrigger,
  PendingEntryAnimation,
  ListAnimationContextType,
} from '#/types/animations';

/**
 * ListAnimationContext
 *
 * Generic animation coordination for any list with real-time updates.
 * Works with shopping lists, pantry, recipes, meal plans, etc.
 *
 * EXIT ANIMATIONS (Ref-based Callback Registry - O(1) performance):
 * - Items register their triggerExit function via registerAnimationTrigger
 * - When subscription needs to animate an item, it calls scheduleAnimation
 * - scheduleAnimation directly calls the registered trigger (no re-renders!)
 * - If item not registered (off-screen), falls back to timeout
 *
 * ENTRY ANIMATIONS:
 * - When item moves between lists, scheduleEntryAnimation is called
 * - New item mounts and claims the entry animation
 * - Item animates in (fade + slide from direction)
 */

interface PendingAnimation {
  itemId: string;
  onComplete: () => void;
  timeoutId?: ReturnType<typeof setTimeout>;
}

const ListAnimationContext = createContext<
  ListAnimationContextType | undefined
>(undefined);

interface ListAnimationProviderProps {
  children: ReactNode;
}

// Timeout for fallback when item is not registered (off-screen/virtualized)
const ANIMATION_TIMEOUT_MS = 500;

// Entry animations expire after this time (item should mount quickly)
const ENTRY_ANIMATION_EXPIRY_MS = 1000;

export const ListAnimationProvider: React.FC<ListAnimationProviderProps> = ({
  children,
}) => {
  // Registry of item animation trigger functions (direct call, no re-renders)
  const animationTriggersRef = useRef<Map<string, ExitAnimationTrigger>>(
    new Map(),
  );

  // Fallback for items not registered (off-screen)
  const pendingAnimationsRef = useRef<Map<string, PendingAnimation>>(new Map());

  // Entry animations waiting to be claimed by mounting items
  const pendingEntryAnimationsRef = useRef<Map<string, PendingEntryAnimation>>(
    new Map(),
  );

  // Track entry animation expiry timeouts for cleanup
  const entryAnimationTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // Cleanup all pending timeouts on unmount to prevent memory leaks
  useEffect(() => {
    // Capture refs inside effect per react-hooks/exhaustive-deps
    const pendingAnimations = pendingAnimationsRef.current;
    const entryAnimationTimeouts = entryAnimationTimeoutsRef.current;
    const pendingEntryAnimations = pendingEntryAnimationsRef.current;
    const animationTriggers = animationTriggersRef.current;

    return () => {
      // Clear pending animation timeouts
      for (const pending of pendingAnimations.values()) {
        if (pending.timeoutId) {
          clearTimeout(pending.timeoutId);
        }
      }
      pendingAnimations.clear();

      // Clear entry animation expiry timeouts
      for (const timeoutId of entryAnimationTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      entryAnimationTimeouts.clear();

      pendingEntryAnimations.clear();
      animationTriggers.clear();
    };
  }, []);

  /**
   * Register an item's animation trigger function.
   * Called by item component via useLayoutEffect on mount.
   */
  const registerAnimationTrigger = (itemId: string, trigger: ExitAnimationTrigger) => {
    animationTriggersRef.current.set(itemId, trigger);

    // Check if there's a pending animation waiting for this item to register
    const pending = pendingAnimationsRef.current.get(itemId);
    if (pending) {
      // Clear the timeout since we can now trigger directly
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pendingAnimationsRef.current.delete(itemId);

      // Trigger the animation now that item is registered
      // Use setTimeout to ensure component is fully mounted
      setTimeout(() => {
        const currentTrigger = animationTriggersRef.current.get(itemId);
        if (currentTrigger) {
          // Default to left direction for delayed triggers
          currentTrigger(-1, pending.onComplete);
        } else {
          // Trigger was unregistered, just run callback
          pending.onComplete();
        }
      }, 0);
    }
  };

  /**
   * Unregister an item's animation trigger.
   * Called by item component cleanup on unmount.
   */
  const unregisterAnimationTrigger = (itemId: string) => {
    animationTriggersRef.current.delete(itemId);
  };

  /**
   * Schedule an exit animation for an item.
   * O(1) performance - directly calls registered trigger.
   * No context state changes = no re-renders.
   */
  const scheduleAnimation = (itemId: string, direction: AnimationDirection, onComplete: () => void) => {
    // Check if animation already pending for this item (deduplicate)
    if (pendingAnimationsRef.current.has(itemId)) {
      return;
    }

    // Try to get the registered trigger
    const trigger = animationTriggersRef.current.get(itemId);

    if (trigger) {
      // Direct call - O(1), no re-renders!
      trigger(direction, onComplete);
    } else {
      // Item not registered (off-screen/virtualized)
      // Set up timeout fallback to ensure cache update happens
      const timeoutId = setTimeout(() => {
        const pending = pendingAnimationsRef.current.get(itemId);
        if (pending) {
          pendingAnimationsRef.current.delete(itemId);
          onComplete();
        }
      }, ANIMATION_TIMEOUT_MS);

      pendingAnimationsRef.current.set(itemId, {
        itemId,
        onComplete,
        timeoutId,
      });
    }
  };

  /**
   * Schedule an entry animation for an item appearing in a new list.
   * Called after cache update moves the item.
   */
  const scheduleEntryAnimation = (itemId: string, direction: AnimationDirection) => {
    // Clear any existing timeout for this item
    const existingTimeout = entryAnimationTimeoutsRef.current.get(itemId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Store the pending entry animation
    pendingEntryAnimationsRef.current.set(itemId, { itemId, direction });

    // Auto-expire entry animations after timeout (item should mount quickly)
    const timeoutId = setTimeout(() => {
      pendingEntryAnimationsRef.current.delete(itemId);
      entryAnimationTimeoutsRef.current.delete(itemId);
    }, ENTRY_ANIMATION_EXPIRY_MS);

    entryAnimationTimeoutsRef.current.set(itemId, timeoutId);
  };

  /**
   * Claim a pending entry animation.
   * Called by item component on mount to check if it should animate in.
   */
  const claimEntryAnimation = (itemId: string) => {
    const pending = pendingEntryAnimationsRef.current.get(itemId);
    if (pending) {
      pendingEntryAnimationsRef.current.delete(itemId);
      // Clear the expiry timeout since animation was claimed
      const timeoutId = entryAnimationTimeoutsRef.current.get(itemId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        entryAnimationTimeoutsRef.current.delete(itemId);
      }
      return pending;
    }
    return undefined;
  };

  const contextValue = {
    registerAnimationTrigger,
    unregisterAnimationTrigger,
    scheduleAnimation,
    scheduleEntryAnimation,
    claimEntryAnimation,
  };

  return (
    <ListAnimationContext.Provider value={contextValue}>
      {children}
    </ListAnimationContext.Provider>
  );
};

/**
 * Hook to access list animation coordination.
 * Throws if not within provider.
 */
export const useListAnimation = (): ListAnimationContextType => {
  const context = useContext(ListAnimationContext);
  if (context === undefined) {
    throw new Error(
      'useListAnimation must be used within a ListAnimationProvider',
    );
  }
  return context;
};

/**
 * Optional hook that returns null if not within provider.
 * Useful for components that may be used outside an animated list context.
 */
export const useListAnimationOptional = (): ListAnimationContextType | null => {
  return useContext(ListAnimationContext) ?? null;
};
