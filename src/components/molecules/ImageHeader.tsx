import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { CachedImage } from '#components/atoms/CachedImage';

export const ImageHeader: React.FC = () => {
  return (
    <View style={styles.header}>
      <CachedImage
        accessibilityLabel="App Logo"
        resizeMode="contain"
        style={styles.headerImg}
        uri="https://assets.withfra.me/SignIn.2.png"
      />
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  /** Header */
  header: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerImg: {
    width: 80,
    height: 80,
    alignSelf: 'center',
  },
}));
