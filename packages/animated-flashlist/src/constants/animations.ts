import { Easing } from 'react-native-reanimated';
import type { ExitAnimationConfig, EntryAnimationConfig } from '../types';

/**
 * Standard cubic bezier easing function for smooth animations
 * Equivalent to CSS ease-in-out with custom curve
 */
export const standardEasing = Easing.bezier(0.25, 0.1, 0.25, 1);

/**
 * Default exit animation configuration
 * Used when items are removed/toggled from the list
 *
 * Timeline (300ms total):
 * - 0-300ms: Slide (300px in direction)
 * - 50-300ms: Scale to 0.95
 * - 100-300ms: Fade out
 */
export const DEFAULT_EXIT_ANIMATION: ExitAnimationConfig = {
  slide: {
    duration: 300,
    distance: 300,
  },
  fade: {
    delay: 100,
    duration: 200,
  },
  scale: {
    delay: 50,
    duration: 250,
    toValue: 0.95,
  },
  removalDelay: 300,
  layoutAnimation: {
    duration: 200,
  },
};

/**
 * Fast exit animation for quick actions (checkbox toggles)
 *
 * Timeline (200ms total):
 * - 0-200ms: Slide (200px in direction)
 * - 0-200ms: Fade out (starts immediately)
 * - 0-200ms: Scale to 0.97
 */
export const FAST_EXIT_ANIMATION: ExitAnimationConfig = {
  slide: {
    duration: 200,
    distance: 200,
  },
  fade: {
    delay: 0,
    duration: 200,
  },
  scale: {
    delay: 0,
    duration: 200,
    toValue: 0.97,
  },
  removalDelay: 200,
  layoutAnimation: {
    duration: 150,
  },
};

/**
 * Default entry animation configuration
 * Used when items appear in the list
 */
export const DEFAULT_ENTRY_ANIMATION: EntryAnimationConfig = {
  fade: { duration: 250 },
  slide: { distance: 50, duration: 300 },
};

/**
 * Get exit animation config by preset
 */
export function getExitAnimationConfig(
  preset: 'default' | 'fast' = 'fast',
  overrides?: Partial<ExitAnimationConfig>,
): ExitAnimationConfig {
  const base = preset === 'fast' ? FAST_EXIT_ANIMATION : DEFAULT_EXIT_ANIMATION;
  if (!overrides) return base;

  return {
    slide: { ...base.slide, ...overrides.slide },
    fade: { ...base.fade, ...overrides.fade },
    scale: { ...base.scale, ...overrides.scale },
    removalDelay: overrides.removalDelay ?? base.removalDelay,
    layoutAnimation: { ...base.layoutAnimation, ...overrides.layoutAnimation },
  };
}

/**
 * Create a merged entry animation config from defaults and overrides
 */
export function createEntryAnimationConfig(
  overrides?: Partial<EntryAnimationConfig>,
): EntryAnimationConfig {
  if (!overrides) return DEFAULT_ENTRY_ANIMATION;

  return {
    fade: { ...DEFAULT_ENTRY_ANIMATION.fade, ...overrides.fade },
    slide: { ...DEFAULT_ENTRY_ANIMATION.slide, ...overrides.slide },
  };
}
