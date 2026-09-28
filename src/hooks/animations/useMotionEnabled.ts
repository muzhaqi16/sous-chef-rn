import { useReducedMotion } from 'react-native-reanimated';

/**
 * False under the OS "reduce motion" setting. Only for motion a zero duration
 * cannot stop — a loop, a shimmer, an ambient illustration — or that Reanimated
 * does not collapse, a CSS transition; `withTiming`, `withSpring`, `withRepeat`
 * and the entering/exiting builders already collapse on their own
 * (`docs/verified-library-behaviour.md#reanimated-applies-reduce-motion-itself`).
 */
export const useMotionEnabled = (): boolean => !useReducedMotion();
