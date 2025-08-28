/**
 * @format
 */

import {AppRegistry} from 'react-native';
// Has to be imported before any other files to ensure the theme is applied globally
import './src/theme/index';
// import App from './App';
import App from './App';

import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
