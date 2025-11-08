/**
 * Polyfill for crypto.getRandomValues()
 * Required for crypto.randomUUID() to work in React Native
 * MUST be imported before any other imports that use crypto
 */
import 'react-native-get-random-values';

/**
 * Configure Apollo Client memory management
 * Per Apollo docs: Set before loading @apollo/client
 * This must be imported before App.tsx (which imports apollo/client)
 */
import './src/apollo/config';

/**
 * @format
 */
import { AppRegistry } from 'react-native';
import './src/theme/unistyles';

import App from './App';

import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
