/** Shared types for the list animation coordination system. */

/** 1 = forward (completed / purchased / starred), -1 = backward. */
export type AnimationDirection = 1 | -1;

/**
 * Exit animation trigger function signature.
 * Called by subscription handlers to trigger exit animation on a list item.
 */
export type ExitAnimationTrigger = (
  direction: AnimationDirection,
  onComplete: () => void,
) => void;

/**
 * Pending entry animation data.
 * Stored when an item should animate in after appearing in a new list.
 */
export interface PendingEntryAnimation {
  itemId: string;
  direction: AnimationDirection;
}

/**
 * Coordinates exit and entry animations between subscription handlers and list
 * items: items register a trigger, a handler schedules the exit, then the cache
 * update schedules an entry the newly-mounted item claims.
 */
export interface ListAnimationContextType {
  /**
   * Register a list item's exit animation trigger function.
   * Called by list item components on mount via useLayoutEffect.
   */
  registerAnimationTrigger: (
    itemId: string,
    trigger: ExitAnimationTrigger,
  ) => void;

  /**
   * Unregister a list item's animation trigger.
   * Called by list item components on unmount.
   */
  unregisterAnimationTrigger: (itemId: string) => void;

  /**
   * Schedule an exit animation for a list item.
   * Directly calls the registered trigger (O(1), no re-renders).
   * Falls back to timeout if item not registered (off-screen).
   */
  scheduleAnimation: (
    itemId: string,
    direction: AnimationDirection,
    onComplete: () => void,
  ) => void;

  /**
   * Schedule an entry animation for an item appearing in a new list.
   * Called after cache update moves the item.
   */
  scheduleEntryAnimation: (
    itemId: string,
    direction: AnimationDirection,
  ) => void;

  /**
   * Claim a pending entry animation for an item.
   * Returns animation details and removes from pending.
   * Called by list item component on mount.
   */
  claimEntryAnimation: (itemId: string) => PendingEntryAnimation | undefined;
}
