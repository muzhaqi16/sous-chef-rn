import React from 'react';
import {SafeAreaView, StatusBar, useColorScheme, Platform} from 'react-native';
import {ApolloProvider} from '@apollo/client';
import {useStore} from './src/store/useStore';
import {client} from './src/apollo/client';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/SplashScreen';

const App = () => {
  const isDarkMode = useColorScheme() === 'dark';
  const {styles, theme} = useStyles(stylesheet);
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

  return (
    <ApolloProvider client={client}>
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
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
}));

export default App;
