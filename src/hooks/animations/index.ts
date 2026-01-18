// Re-export animation hooks and types from the package for convenience
export {
  useListExitAnimation,
  useListEntryAnimation,
  type ExitAnimationPreset,
} from '@souscheflabs/reanimated-flashlist';

// Re-export types for convenience
export type { AnimationDirection } from '#/types/animations';

// Local animation hooks
export { useAnimatedPresence } from './useAnimatedPresence';
export type {
  SpringConfig,
  AnimatedPresenceCallbacks,
  UseAnimatedPresenceProps,
  UseAnimatedPresenceReturn,
} from './types';
