import React, {useEffect, useState} from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {ApolloProvider} from '@apollo/client';
import {useStore} from './src/store';
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
import {ToastProvider} from './src/components/atoms';
import {Text} from 'react-native-gesture-handler';

const App = () => {
  const darkMode = useColorScheme() === 'dark';
  const {theme: userTheme} = useStore(store => store.preferences);
  const effectiveDark =
    darkMode !== undefined ? darkMode : userTheme === 'dark';

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
  if (!client) {
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
          <Text style={styles.text}>API_URL: {Config.API_URL}</Text>
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
