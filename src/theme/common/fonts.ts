export const fontFamilies = {
  body: 'Inter, sans-serif',
  heading: 'Inter, sans-serif',
  mono: 'Menlo, monospace',
};

export type FontFamilies = typeof fontFamilies;

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
};
export type FontSizes = typeof fontSizes;

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
};
export type FontWeights = typeof fontWeights;

export const lineHeights = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  '4xl': 36,
};

export type LineHeights = typeof lineHeights;

export const letterSpacings = {
  tighter: -0.5,
  tight: -0.25,
  normal: 0,
  wide: 0.25,
  wider: 0.5,
  widest: 1,
};
export type LetterSpacings = typeof letterSpacings;

export const textTransforms = {
  uppercase: 'uppercase',
  lowercase: 'lowercase',
  capitalize: 'capitalize',
  none: 'none',
};

export type TextTransforms = typeof textTransforms;

export const fonts = {
  family: fontFamilies,
  size: fontSizes,
  weight: fontWeights,
  lineHeight: lineHeights,
  letterSpacing: letterSpacings,
  textTransform: textTransforms,
};

export type Fonts = typeof fonts;
