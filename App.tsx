import React from 'react';
import {StatusBar} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {ApolloProvider} from '@apollo/client';
import {enableScreens} from 'react-native-screens';
import {useStore} from '#store';
import {client} from './src/apollo/client';
import {Navigation} from './src/navigation/RootNavigator';
import {SplashScreen} from '#screens';
import {ToastProvider} from '#/components/atoms';
import {useTheme} from '#/hooks/useTheme';

// Enable native screens for better performance
enableScreens();

const App = () => {
  const isHydrated = useStore(store => store.isHydrated);
  const {theme} = useTheme();
  const isDark = theme === 'dark';

  // Early return for loading state
  if (!isHydrated || !client) {
    console.error('App is not hydrated or Apollo client is not initialized');
    return <SplashScreen />;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <ApolloProvider client={client}>
        <SafeAreaProvider>
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
            backgroundColor={isDark ? '#212121' : '#FAFAFA'}
          />
          <SafeAreaView style={styles.container}>
            <ToastProvider>
              <BottomSheetModalProvider>
                <Navigation
                  linking={{
                    enabled: 'auto',
                    prefixes: ['souchef://', 'https://app.souschef.dev'],
                  }}
                />
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
  },
  text: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    margin: 10,
  },
}));

export default App;
