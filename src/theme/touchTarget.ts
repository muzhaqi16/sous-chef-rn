import { Platform, type Insets } from 'react-native';

/** The smallest touch target each platform asks for: 48 dp (Material), 44 pt (HIG). */
export const TOUCH_TARGET_MIN = Platform.select({ android: 48, default: 44 });

/** The slop that brings a control of this visible size up to the floor, per axis. */
export function hitSlopFor(width: number, height: number): Insets {
  const horizontal = Math.max(0, (TOUCH_TARGET_MIN - width) / 2);
  const vertical = Math.max(0, (TOUCH_TARGET_MIN - height) / 2);
  return {
    top: vertical,
    bottom: vertical,
    left: horizontal,
    right: horizontal,
  };
}
