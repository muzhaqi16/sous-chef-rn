/**
 * Ripples render natively, so press feedback survives a busy JS thread. iOS
 * ignores `android_ripple` — keep a `({ pressed }) => …` callback for it.
 * Colors are literal, not theme tokens: this is a config object passed to
 * native, not a style, and translucent black/white reads in both schemes.
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
