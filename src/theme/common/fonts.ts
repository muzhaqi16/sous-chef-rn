/** 1. Font size scale (single source of truth) */
export const fontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
  '5xl': 32,
  '6xl': 36,
} as const;
export type FontSizeKey = keyof typeof fontSizes;
export type FontSizes = typeof fontSizes;

/** 2. Font families */
export const fontFamilies = {
  body: 'Inter',
  heading: 'Inter',
  mono: 'Menlo',
} as const;
export type FontFamilyKey = keyof typeof fontFamilies;
export type FontFamilies = typeof fontFamilies;

/** 3. Font weights */
export const fontWeights = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
export type FontWeightKey = keyof typeof fontWeights;
export type FontWeights = typeof fontWeights;

/** 4. Line heights (tied to fontSizes scale) */
export const lineHeights = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  '4xl': 36,
} as const;
export type LineHeightKey = keyof typeof lineHeights;
export type LineHeights = typeof lineHeights;

/** 5. Letter spacing */
export const letterSpacings = {
  tighter: -0.5,
  tight: -0.25,
  normal: 0,
  wide: 0.25,
  wider: 0.5,
  widest: 1,
} as const;
export type LetterSpacingKey = keyof typeof letterSpacings;
export type LetterSpacings = typeof letterSpacings;

/** 6. Text transforms */
export const textTransforms = {
  none: 'none',
  uppercase: 'uppercase',
  lowercase: 'lowercase',
  capitalize: 'capitalize',
} as const;
export type TextTransformKey = keyof typeof textTransforms;
export type TextTransforms = typeof textTransforms;

/** 7. Bundle all into a single `fonts` export for your theme */
export const fonts = {
  family: fontFamilies,
  size: fontSizes,
  weight: fontWeights,
  lineHeight: lineHeights,
  letterSpacing: letterSpacings,
  textTransform: textTransforms,
} as const;

export type Fonts = typeof fonts;
