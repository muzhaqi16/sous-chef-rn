import React, {useEffect} from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {ApolloProvider} from '@apollo/client';
import {useStore} from './src/store/useStore';
import {client} from './src/apollo/client';
import {
  useInitialTheme,
  createStyleSheet,
  UnistylesRuntime,
  useStyles,
} from 'react-native-unistyles';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/SplashScreen';
import {ToastProvider} from './src/components/atoms';

const App = () => {
  const systemIsDark = useColorScheme() === 'dark';
  const {darkMode} = useStore(store => store.preferences);
  const effectiveDark = darkMode !== undefined ? darkMode : systemIsDark;

  useInitialTheme(effectiveDark ? 'dark' : 'light');
  const {styles, theme} = useStyles(stylesheet);
  const {colors} = theme;

  useEffect(() => {
    UnistylesRuntime.setTheme(effectiveDark ? 'dark' : 'light');
  }, [effectiveDark]);

  const isHydrated = useStore(store => store.isHydrated);

  if (!isHydrated) {
    return <SplashScreen />;
  }

  return (
    <ApolloProvider client={client}>
      <SafeAreaProvider>
        <StatusBar
          barStyle={effectiveDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <SafeAreaView style={styles.container}>
          <ToastProvider>
            <AppNavigator />
          </ToastProvider>
        </SafeAreaView>
      </SafeAreaProvider>
    </ApolloProvider>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    // SafeAreaView padding for Android to avoid the status bar or notch overlapping the content.
    // paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  text: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    margin: 10,
  },
}));

export default App;
