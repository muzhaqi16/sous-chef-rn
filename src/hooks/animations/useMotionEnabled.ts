import { useReducedMotion } from 'react-native-reanimated';

/**
 * False under the OS "reduce motion" setting. Only for motion a zero duration
 * cannot stop — a loop, a shimmer, an ambient illustration; `withTiming`,
 * `withSpring`, `withRepeat` and the entering/exiting builders already collapse
 * on their own (`docs/verified-library-behaviour.md#reanimated-reduce-motion`).
 */
export const useMotionEnabled = (): boolean => !useReducedMotion();
