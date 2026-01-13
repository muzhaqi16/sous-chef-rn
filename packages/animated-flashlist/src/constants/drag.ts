import type { DragConfig } from '../types';

/**
 * Default drag configuration
 * All values can be overridden via AnimatedFlashList config prop
 */
export const DEFAULT_DRAG_CONFIG: DragConfig = {
  /**
   * Fixed height for list items used in drag calculations.
   * Override this to match your item height + margins
   */
  itemHeight: 95,

  /**
   * Scale factor applied to dragged item for visual feedback
   */
  dragScale: 1.03,

  /**
   * Shadow opacity for dragged item (increases from 0.1 to this value)
   */
  dragShadowOpacity: 0.25,

  /**
   * Vertical margin per item (total margin = 2 * itemVerticalMargin)
   */
  itemVerticalMargin: 8,

  /**
   * Duration (ms) to hold drag handle before drag activates
   */
  longPressDuration: 200,

  /**
   * Pixels from viewport edge to trigger autoscroll
   */
  edgeThreshold: 80,

  /**
   * Maximum scroll speed in pixels per frame at edge
   */
  maxScrollSpeed: 10,
};

/**
 * Create a merged drag config from defaults and overrides
 */
export function createDragConfig(overrides?: Partial<DragConfig>): DragConfig {
  if (!overrides) return DEFAULT_DRAG_CONFIG;
  return { ...DEFAULT_DRAG_CONFIG, ...overrides };
}
