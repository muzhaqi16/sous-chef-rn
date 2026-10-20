import {
  Easing,
  type CSSTransitionTimingFunction,
} from 'react-native-reanimated';
import { spring, timing } from './foundations/motion';

/** The curves. `standard` is CSS `ease`, cubic-bezier(0.25, 0.1, 0.25, 1). */
const easing = {
  standard: Easing.bezier(0.25, 0.1, 0.25, 1),
  /** Symmetric ease for a value that returns to where it started. */
  emphasized: Easing.inOut(Easing.ease),
  /** Fast out, slow in — for something arriving at rest. */
  decelerate: Easing.out(Easing.cubic),
  gentle: Easing.out(Easing.ease),
  plain: Easing.ease,
};

interface CssEasing {
  standard: CSSTransitionTimingFunction;
}

/** The same curves as timing functions for a Reanimated CSS transition. */
const cssEasing: CssEasing = {
  standard: 'ease',
};

// There are no reduce-motion substitutes here on purpose. Reanimated collapses
// `withTiming`, `withSpring`, `withRepeat` and the entering/exiting builders
// under the OS setting itself, so a second set of zeroed tokens is a mechanism
// with nothing to drive. See `docs/verified-library-behaviour.md`.
/** Durations and springs from the tokens, with Reanimated's curves. */
export const motion = { timing, spring, easing, cssEasing };
