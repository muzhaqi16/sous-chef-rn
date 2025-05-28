import React from 'react';
import {SafeAreaView, StatusBar, useColorScheme, Platform} from 'react-native';
import {ApolloProvider} from '@apollo/client';
import {client} from './src/apollo/client';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import AppNavigator from './src/navigation/AppNavigator';

const App = () => {
  const isDarkMode = useColorScheme() === 'dark';
  const {styles, theme} = useStyles(stylesheet);
  const {colors} = theme;

  return (
    <ApolloProvider client={client}>
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={colors.backgroundColor}
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
