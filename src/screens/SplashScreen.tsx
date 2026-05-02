import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SousChefLoader } from '#components/base/SousChefLoader';

export const SplashScreen = () => {
  return (
    <View style={styles.container} testID="splash-screen">
      <SousChefLoader size="large" message="Loading" showBrand={true} />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
