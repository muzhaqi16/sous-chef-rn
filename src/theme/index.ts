import {UnistylesRegistry} from 'react-native-unistyles';
import {breakpoints, Breakpoints} from './common/breakpoints';
import {lightTheme, darkTheme, AppTheme} from './themes';

// 1) Tell TS your Unistyles shapes
declare module 'react-native-unistyles' {
  export interface UnistylesBreakpoints extends Breakpoints {}
  export interface UnistylesThemes {
    light: AppTheme;
    dark: AppTheme;
  }
}

// 2) Register them (run this before your app mounts!)
UnistylesRegistry.addBreakpoints(breakpoints)
  .addThemes({light: lightTheme, dark: darkTheme})
  .addConfig({adaptiveThemes: true});
