import React, {useEffect} from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {ApolloProvider} from '@apollo/client';
import {useStore} from './src/store';
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
import {Text} from 'react-native-gesture-handler';

const App = () => {
  const darkMode = useColorScheme() === 'dark';
  const {theme: userTheme} = useStore();
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
    <GestureHandlerRootView style={styles.container}>
      <ApolloProvider client={client}>
        <SafeAreaProvider>
          <StatusBar
            barStyle={effectiveDark ? 'light-content' : 'dark-content'}
            backgroundColor={colors.background}
          />
          <SafeAreaView style={styles.container}>
            <ToastProvider>
              {/* BottomSheetModalProvider needs to be above NavigationContainer */}
              <BottomSheetModalProvider>
                <AppNavigator />
              </BottomSheetModalProvider>
            </ToastProvider>
          </SafeAreaView>
        </SafeAreaProvider>
      </ApolloProvider>
    </GestureHandlerRootView>
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
