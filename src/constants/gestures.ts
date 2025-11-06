/**
 * Gesture configuration constants for drag-and-drop and swipe interactions
 */

/**
 * Distance (in pixels) the pan gesture must move before activating.
 *
 * NOT USED - Kept for reference only.
 *
 * Since we use explicit drag handles that call drag() directly, we don't need
 * the pan gesture to auto-activate. Instead, we use DRAG_DISABLED_DISTANCE
 * (effectively infinite) to prevent any auto-activation and allow smooth scrolling.
 */
export const DRAG_ACTIVATION_DISTANCE = 20;

/**
 * Maximum distance used to disable automatic drag activation.
 *
 * Set to Number.MAX_SAFE_INTEGER (effectively infinite) to prevent the pan gesture
 * from auto-activating on touch movement. This allows smooth scrolling while still
 * supporting drag-to-reorder via explicit drag handles.
 *
 * How this works:
 * - Scrolling: Pan gesture never activates (requires impossible movement), so scroll
 *   gestures work perfectly in all directions.
 * - Dragging: Drag handles call drag() explicitly, which bypasses activationDistance
 *   entirely, so drag-to-reorder still works.
 *
 * This is the value used in SortableShoppingList for activationDistance.
 */
export const DRAG_DISABLED_DISTANCE = Number.MAX_SAFE_INTEGER;

/**
 * Maximum height for nested scrollable lists (in pixels).
 *
 * Prevents performance issues with very long nested lists by limiting
 * the scrollable area to a reasonable size.
 */
export const MAX_NESTED_LIST_HEIGHT = 600;
