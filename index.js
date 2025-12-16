/**
 * Polyfill for crypto.getRandomValues()
 * Required for crypto.randomUUID() to work in React Native
 * MUST be imported before any other imports that use crypto
 */
import 'react-native-get-random-values';
import { LogBox } from 'react-native';
/**
 * Configure Reanimated logger BEFORE any Reanimated code runs
 * This prevents "Cannot read property 'level' of undefined" errors
 * Must be called before any imports that use Reanimated animations
 */
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated';

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

/**
 * Configure Apollo Client memory management
 * Per Apollo docs: Set before loading @apollo/client
 * This must be imported before App.tsx (which imports apollo/client)
 */
import './src/apollo/config';

/**
 * Setup notification handlers for Notifee
 * Must be registered early to handle background notification events
 */
import { setupNotificationHandlers } from './src/utils/notifications/localNotificationHelper';
setupNotificationHandlers();

/**
 * @format
 */
import { AppRegistry } from 'react-native';
import './src/theme/unistyles';

import App from './App';

import { name as appName } from './app.json';

// Will be removed when upgrading to react navigation 8
LogBox.ignoreLogs([
  'InteractionManager has been deprecated and will be removed in a future release.',
]);

AppRegistry.registerComponent(appName, () => App);
