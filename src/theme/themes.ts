import {
  fonts,
  margins,
  spacing,
  lightColors,
  darkColors,
  breakpoints,
  Colors,
  Breakpoints,
  Fonts,
  Margins,
  Spacing,
} from './common';
interface Theme {
  colors: Colors;
  breakpoints: Breakpoints;
  spacing: Spacing;
  fonts: Fonts;
  margins: Margins;
}

export const lightTheme: Theme = {
  colors: lightColors,
  breakpoints,
  spacing,
  fonts,
  margins,
};

export const darkTheme: Theme = {
  colors: darkColors,
  breakpoints,
  spacing,
  fonts,
  margins,
};
