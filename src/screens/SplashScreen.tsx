import React from 'react';
import { View, Text, Image } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Loader from '../components/atoms/Loader';

export const SplashScreen = () => {
  return (
    <View style={styles.container} testID="splash-screen">
      <View style={styles.imageWrapper}>
        <Image
          source={require('../assets/images/logo.png')}
          resizeMode="contain"
          style={styles.image}
        />
      </View>

      <View style={styles.loaderWrapper}>
        <Loader />
        <Text style={styles.text}>Loading...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  imageWrapper: {
    flex: 1, // fill the screen
    justifyContent: 'center', // center vertically
    alignItems: 'center', // center horizontally
  },
  image: {
    width: 300,
    height: 300,
  },
  loaderWrapper: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  text: {
    fontSize: theme.fonts.size.xl,
    color: theme.colors.textPrimary,
    paddingVertical: theme.spacing.md,
  },
}));
