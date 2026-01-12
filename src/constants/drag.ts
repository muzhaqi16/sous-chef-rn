/**
 * Drag-to-reorder animation constants
 * Used by drag hooks and SortableItem for consistent behavior
 */

/**
 * Fixed height for shopping list items used in drag calculations.
 * 87px content + 8px margins (spacing.xs = 4px each side)
 * Used by: useDragGesture (position math), SortableList (overrideItemLayout)
 */
export const DRAG_ITEM_HEIGHT = 95;

/**
 * Scale factor applied to dragged item for visual feedback
 */
export const DRAG_SCALE = 1.03;

/**
 * Shadow opacity for dragged item (increases from 0.1 to this value)
 */
export const DRAG_SHADOW_OPACITY = 0.25;

/**
 * Vertical margin per item (marginVertical: spacing.xs = 4px each side)
 */
export const ITEM_VERTICAL_MARGIN = 8;

/**
 * Duration (ms) to hold drag handle before drag activates
 * Consolidated from inconsistent 150ms/200ms values
 */
export const LONG_PRESS_DURATION = 200;

// === Autoscroll Constants ===

/**
 * Pixels from viewport edge to trigger autoscroll
 */
export const EDGE_THRESHOLD = 80;

/**
 * Maximum scroll speed in pixels per frame at edge
 */
export const MAX_SCROLL_SPEED = 10;
