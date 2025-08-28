import React from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {ApolloProvider} from '@apollo/client';
import {useStore} from '#store';
import {client} from './src/apollo/client';
import AppNavigator from '#navigation/AppNavigator';
import SplashScreen from '#/screens/SplashScreen';
import {ToastProvider} from '#/components/atoms';

const App = () => {
  const isHydrated = useStore(store => store.isHydrated);
  const darkMode = useColorScheme() === 'dark';

  const {theme: userTheme} = useStore();
  const {theme} = useUnistyles();
  const effectiveDark =
    darkMode !== undefined ? darkMode : userTheme === 'dark';

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
            backgroundColor={theme.colors.background}
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

const styles = StyleSheet.create(theme => ({
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
