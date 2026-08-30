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
 * Animation coordination for any list with real-time updates. Exits go through a
 * ref-based registry: an item registers its trigger, `scheduleAnimation` calls it
 * directly with no re-render, and an unregistered (off-screen) item falls back to
 * a timeout. Entries are queued by `scheduleEntryAnimation` and claimed on mount.
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

const ANIMATION_TIMEOUT_MS = 500;

const ENTRY_ANIMATION_EXPIRY_MS = 1000;

export const ListAnimationProvider: React.FC<ListAnimationProviderProps> = ({
  children,
}) => {
  const animationTriggersRef = useRef<Map<string, ExitAnimationTrigger>>(
    new Map(),
  );

  const pendingAnimationsRef = useRef<Map<string, PendingAnimation>>(new Map());

  const pendingEntryAnimationsRef = useRef<Map<string, PendingEntryAnimation>>(
    new Map(),
  );

  const entryAnimationTimeoutsRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());

  useEffect(() => {
    const pendingAnimations = pendingAnimationsRef.current;
    const entryAnimationTimeouts = entryAnimationTimeoutsRef.current;
    const pendingEntryAnimations = pendingEntryAnimationsRef.current;
    const animationTriggers = animationTriggersRef.current;

    return () => {
      for (const pending of pendingAnimations.values()) {
        if (pending.timeoutId) {
          clearTimeout(pending.timeoutId);
        }
      }
      pendingAnimations.clear();

      for (const timeoutId of entryAnimationTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      entryAnimationTimeouts.clear();

      pendingEntryAnimations.clear();
      animationTriggers.clear();
    };
  }, []);

  /** Called by the item from a layout effect on mount. */
  const registerAnimationTrigger = (
    itemId: string,
    trigger: ExitAnimationTrigger,
  ) => {
    animationTriggersRef.current.set(itemId, trigger);

    const pending = pendingAnimationsRef.current.get(itemId);
    if (pending) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pendingAnimationsRef.current.delete(itemId);

      // rAF so the component is mounted and painted before the trigger runs.
      requestAnimationFrame(() => {
        const currentTrigger = animationTriggersRef.current.get(itemId);
        if (currentTrigger) {
          currentTrigger(-1, pending.onComplete);
        } else {
          pending.onComplete();
        }
      });
    }
  };

  const unregisterAnimationTrigger = (itemId: string) => {
    animationTriggersRef.current.delete(itemId);
  };

  /** Calls the registered trigger directly; no context state change, no re-render. */
  const scheduleAnimation = (
    itemId: string,
    direction: AnimationDirection,
    onComplete: () => void,
  ) => {
    if (pendingAnimationsRef.current.has(itemId)) {
      return;
    }

    const trigger = animationTriggersRef.current.get(itemId);

    if (trigger) {
      trigger(direction, onComplete);
    } else {
      // Off-screen and unregistered: a timeout guarantees the cache update.
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

  /** Called after the cache update that moves the item. */
  const scheduleEntryAnimation = (
    itemId: string,
    direction: AnimationDirection,
  ) => {
    const existingTimeout = entryAnimationTimeoutsRef.current.get(itemId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    pendingEntryAnimationsRef.current.set(itemId, { itemId, direction });

    const timeoutId = setTimeout(() => {
      pendingEntryAnimationsRef.current.delete(itemId);
      entryAnimationTimeoutsRef.current.delete(itemId);
    }, ENTRY_ANIMATION_EXPIRY_MS);

    entryAnimationTimeoutsRef.current.set(itemId, timeoutId);
  };

  const claimEntryAnimation = (itemId: string) => {
    const pending = pendingEntryAnimationsRef.current.get(itemId);
    if (pending) {
      pendingEntryAnimationsRef.current.delete(itemId);
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

export const useListAnimation = (): ListAnimationContextType => {
  const context = useContext(ListAnimationContext);
  if (context === undefined) {
    throw new Error(
      'useListAnimation must be used within a ListAnimationProvider',
    );
  }
  return context;
};

/** Returns null outside a provider, for components usable in either place. */
export const useListAnimationOptional = (): ListAnimationContextType | null => {
  return useContext(ListAnimationContext) ?? null;
};
