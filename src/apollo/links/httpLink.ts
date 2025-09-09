import {createHttpLink} from '@apollo/client';
import Config from 'react-native-config';

// Log configuration for debugging
console.log('[HttpLink] Config.API_URL:', Config.API_URL);
console.log('[HttpLink] __DEV__:', __DEV__);

if (!Config.API_URL) {
  console.error('[HttpLink] API_URL not found in react-native-config!');
  console.error('[HttpLink] Current config keys:', Object.keys(Config));
  console.error('[HttpLink] Make sure you have built the app with the correct ENVFILE');
  console.error('[HttpLink] Run: npm run android:clean && ENVFILE=.env.production npm run android:release');
}

export const httpLink = createHttpLink({
  uri: Config.API_URL,
});
