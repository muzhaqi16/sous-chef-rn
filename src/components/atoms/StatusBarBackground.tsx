import React from 'react';
import {View, Platform} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';

export const StatusBarBackground: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {theme} = useUnistyles();

  // Only needed on Android - iOS handles status bar background differently
  if (Platform.OS !== 'android') return null;

  return (
    <View
      style={[
        styles.container,
        {
          height: insets.top,
          backgroundColor: theme.colors.background,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // No zIndex - relies on render order in App.tsx
  },
}));
