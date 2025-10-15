/**
 * @format
 */
import {LogBox} from 'react-native';
import {AppRegistry} from 'react-native';
// Has to be imported before any other files to ensure the theme is applied globally
import './src/theme/index';
// import App from './App';
import App from './App';

import {name as appName} from './app.json';

LogBox.ignoreLogs([
  'Unistyles: we detected style object with 2 unistyles styles. This might cause no updates or unpredictable behavior.',
]); // Ignore log notification by message

// Also suppress in browser console when debugging
if (__DEV__ && typeof console !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (
      args[0] &&
      args[0].includes &&
      args[0].includes(
        'Unistyles: we detected style object with 2 unistyles styles',
      )
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
}
// LogBox.ignoreAllLogs();

AppRegistry.registerComponent(appName, () => App);
