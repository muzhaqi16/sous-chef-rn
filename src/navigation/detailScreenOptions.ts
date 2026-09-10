import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { motion } from '#/theme/foundations/motion';

/**
 * Shared options for feature detail/sub screens — full-screen swipe-back and a
 * 250ms slide. Every feature's screen-registration module applies these, so a
 * pushed detail screen feels the same wherever it was opened from.
 */
export const detailScreenOptions: NativeStackNavigationOptions = {
  fullScreenGestureEnabled: true,
  animationDuration: motion.timing.MODERATE,
};

/** Settings rows crossfade rather than slide — they read as swapping panels. */
export const settingsScreenOptions: NativeStackNavigationOptions = {
  animation: 'fade',
  animationDuration: motion.timing.FAST,
};

/** Card-presented screens that slide in from the right. */
export const cardScreenOptions: NativeStackNavigationOptions = {
  presentation: 'card',
  animation: 'slide_from_right',
};
