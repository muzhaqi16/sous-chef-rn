/**
 * Android ripple presets for `Pressable.android_ripple`.
 *
 * Ripples render natively on Android, so the press feedback stays responsive
 * even when the JS thread is busy. iOS ignores `android_ripple`; consumers
 * should keep their `({ pressed }) => ...` style callback for iOS feedback.
 *
 * Colors are hardcoded translucent black/white rather than theme tokens because
 * `android_ripple` is a plain config object passed to native, not a style.
 * Translucent black/white reads acceptably in both light and dark mode.
 */
export const RIPPLE = {
  /** Cards, list rows, navigation rows — quiet feedback for large surfaces. */
  SUBTLE: { color: 'rgba(0,0,0,0.06)', borderless: false },
  /** Buttons and chips on light surfaces. */
  DEFAULT: { color: 'rgba(0,0,0,0.1)', borderless: false },
  /** Buttons on primary/danger/dark backgrounds. */
  PRIMARY: { color: 'rgba(255,255,255,0.2)', borderless: false },
};

/** Borderless circular ripple for icon buttons. `radius` matches the icon's hit ring. */
export const borderlessRipple = (radius: number) => ({
  borderless: true,
  radius,
});
