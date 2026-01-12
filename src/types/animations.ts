/**
 * Animation Types
 *
 * Shared types for the list animation coordination system.
 * Used across shopping lists, pantry, recipes, and other animated lists.
 */

/**
 * Direction for animations
 * 1 = forward (right, completed, purchased, starred)
 * -1 = backward (left, uncompleted, unpurchased, unstarred)
 */
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
 * Animation context interface (domain-agnostic).
 * Coordinates exit and entry animations between subscription handlers and list items.
 *
 * Pattern:
 * 1. List items register their exit trigger via registerAnimationTrigger
 * 2. Subscription handlers call scheduleAnimation to trigger exit
 * 3. After cache update, scheduleEntryAnimation is called
 * 4. New item mounts and claims entry animation via claimEntryAnimation
 */
export interface ListAnimationContextType {
  /**
   * Register a list item's exit animation trigger function.
   * Called by list item components on mount via useLayoutEffect.
   */
  registerAnimationTrigger: (itemId: string, trigger: ExitAnimationTrigger) => void;

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
  scheduleEntryAnimation: (itemId: string, direction: AnimationDirection) => void;

  /**
   * Claim a pending entry animation for an item.
   * Returns animation details and removes from pending.
   * Called by list item component on mount.
   */
  claimEntryAnimation: (itemId: string) => PendingEntryAnimation | undefined;
}
