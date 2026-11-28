import { colors } from '#theme/foundations/colors';

/**
 * Ripples render natively, so press feedback survives a busy JS thread. iOS
 * ignores `android_ripple` — keep a `({ pressed }) => …` callback for it.
 */
export const RIPPLE = {
  /** Cards, list rows, navigation rows — quiet feedback for large surfaces. */
  SUBTLE: { color: colors.ripple.subtle, borderless: false },
};

/** Borderless circular ripple for icon buttons. `radius` matches the icon's hit ring. */
export const borderlessRipple = (radius: number) => ({
  borderless: true,
  radius,
});
