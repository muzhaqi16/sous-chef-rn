import {
  spacing,
  Spacing,
  fonts,
  Fonts,
  radii,
  Radii,
  sizes,
  Sizes,
  lightColors,
  ThemeColors,
  darkColors,
} from './common';

type ThemeType = {
  spacing: Spacing;
  fonts: Fonts;
  radii: Radii;
  sizes: Sizes;
  colors: ThemeColors;
};

export const lightTheme: ThemeType = {
  spacing,
  fonts,
  radii,
  sizes,
  colors: lightColors,
};

export const darkTheme: ThemeType = {
  spacing,
  fonts,
  radii,
  sizes,
  colors: darkColors,
};

export type AppTheme = typeof lightTheme;
