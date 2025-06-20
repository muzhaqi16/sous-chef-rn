import {
  fonts,
  type Fonts,
  breakpoints,
  type Breakpoints,
  type ThemeColors as Colors,
  spacings,
  type Spacings,
  lightColors,
  darkColors,
} from './common';

interface Theme {
  colors: Colors;
  breakpoints: Breakpoints;
  spacing: Spacings;
  font: Fonts;
}

export const lightTheme: Theme = {
  colors: lightColors,
  breakpoints,
  spacing: spacings,
  font: fonts,
};

export const darkTheme: Theme = {
  colors: darkColors,
  breakpoints,
  spacing: spacings,
  font: fonts,
};
