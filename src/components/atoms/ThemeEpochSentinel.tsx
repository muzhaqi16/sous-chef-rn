import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useThemeEpoch } from '#hooks/ui/useThemeEpoch';

/**
 * Re-keyed on every theme commit, so React rebuilds its parent from the
 * current shadow nodes rather than re-attaching a pre-theme copy. Goes inside a
 * Reanimated container whose descendants carry themed Unistyles styles.
 */
export const ThemeEpochSentinel: React.FC = () => {
  const epoch = useThemeEpoch();
  return <View key={epoch} style={styles.sentinel} />;
};

const styles = StyleSheet.create({
  sentinel: {
    position: 'absolute',
    width: 0,
    height: 0,
    pointerEvents: 'none',
  },
});
