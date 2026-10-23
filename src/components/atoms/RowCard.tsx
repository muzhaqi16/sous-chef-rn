import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface RowCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * One list row's card: its fill, corners and shadow, and the gap below it. The
 * inner clip rounds what the row draws under itself (a swipe tray, a press
 * ripple); a clip on the card itself would cut its own shadow off.
 */
export const RowCard: React.FC<RowCardProps> = ({
  children,
  style,
  testID,
}) => (
  <View style={[styles.card, style]} testID={testID}>
    <View style={styles.clip}>{children}</View>
  </View>
);

const styles = StyleSheet.create(theme => ({
  card: {
    marginBottom: theme.layout.rowGap,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    ...theme.shadows.card,
  },
  clip: {
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    // Keeps the row's slots inside this view. A background-only view lends its
    // children to the nearest ancestor that holds its own, and Fabric can
    // re-insert them there under this fill: the checkbox and badge vanish.
    isolation: 'isolate',
  },
}));
