import React, {useEffect} from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {ApolloProvider} from '@apollo/client';
import {useStore} from '#store';
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
import {
  setupNotificationHandlers,
  setBadgeCount,
} from '#utils/notifications/localNotificationHelper';
import {useNotificationSubscriptions, useNotificationPermissions} from './src/hooks/notifications';

const App = () => {
  const isHydrated = useStore(store => store.isHydrated);
  // Get unread count and user ID from the store
  const unreadCount = useStore(state => state.unreadCount);
  const userId = useStore(state => state.user?.id);

  const darkMode = useColorScheme() === 'dark';
  const {styles, theme} = useStyles(stylesheet);
  const {colors} = theme;
  const {theme: userTheme} = useStore();

  const effectiveDark =
    darkMode !== undefined ? darkMode : userTheme === 'dark';

  useInitialTheme(effectiveDark ? 'dark' : 'light');

  // Request notification permissions
  const {requestPermissions} = useNotificationPermissions();

  useEffect(() => {
    // Ensure the app is hydrated before proceeding
    if (!isHydrated) {
      return;
    }

    // Request notification permissions
    requestPermissions();
    // Setup notification handlers
    const unsubscribe = setupNotificationHandlers();
    return () => {
      unsubscribe();
    };
  }, [isHydrated, requestPermissions]);

  // Update badge count when unread count changes
  useEffect(() => {
    setBadgeCount(unreadCount);
  }, [unreadCount]);

  // Set the theme for Unistyles
  useEffect(() => {
    UnistylesRuntime.setTheme(effectiveDark ? 'dark' : 'light');
  }, [effectiveDark]);

  // Early return for loading state - before any conditional hooks
  if (!isHydrated || !client) {
    console.error('App is not hydrated or Apollo client is not initialized');
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
