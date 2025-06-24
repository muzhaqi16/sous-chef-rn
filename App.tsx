import React, {useEffect} from 'react';
import {
  SafeAreaView,
  StatusBar,
  useColorScheme,
  Platform,
  Text,
} from 'react-native';
import {ApolloProvider} from '@apollo/client';
import {useStore} from './src/store/useStore';
import {client} from './src/apollo/client';
import Config from 'react-native-config';
import {
  useInitialTheme,
  createStyleSheet,
  UnistylesRuntime,
  useStyles,
} from 'react-native-unistyles';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/SplashScreen';

const App = () => {
  const systemIsDark = useColorScheme() === 'dark';
  const {darkMode} = useStore(s => s.preferences);
  // prefer stored preference, otherwise use system
  const effectiveDark = darkMode !== undefined ? darkMode : systemIsDark;
  // must come before useStyles!
  useInitialTheme(effectiveDark ? 'dark' : 'light');
  const {styles, theme} = useStyles(stylesheet);
  // Use the initial theme based on the effective dark mode setting
  const {colors} = theme;

  // Check if the store is hydrated (i.e., if the initial state has been loaded)
  // This is important to ensure we don't render the app before the store is ready
  // and we have the necessary data (like user authentication status).
  // If the store is not hydrated, we show a splash screen.
  const isHydrated = useStore(s => s.isHydrated);
  if (!isHydrated) {
    // We haven't finished checking for the token yet
    return <SplashScreen />;
  }

  // Subscribe to theme changes
  useEffect(() => {
    UnistylesRuntime.setTheme(effectiveDark ? 'dark' : 'light');
  }, [effectiveDark]);

  return (
    <ApolloProvider client={client}>
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle={effectiveDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <Text style={styles.text}>API URL: {Config.API_URL}</Text>
        <AppNavigator />
      </SafeAreaView>
    </ApolloProvider>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    // SafeAreaView padding for Android to avoid the status bar or notch overlapping the content.
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  text: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    margin: 10,
  },
}));

export default App;
