import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

interface CountBadgeProps {
  /** Hidden at zero or below. */
  count: number | undefined;
}

/**
 * A count over a control's top-right corner, such as active filters. Its parent
 * positions it, so it sits inside a view with no clip.
 */
export const CountBadge: React.FC<CountBadgeProps> = ({ count }) =>
  count !== undefined && count > 0 ? (
    <View style={styles.badge} pointerEvents="none">
      <Text role="caption" tone="onPrimary" style={styles.badgeText}>
        {String(count)}
      </Text>
    </View>
  ) : null;

const styles = StyleSheet.create(theme => ({
  badge: {
    position: 'absolute',
    top: -theme.spacing.xs,
    right: -theme.spacing.xsPlus,
    minWidth: theme.spacing.md,
    height: theme.spacing.md,
    paddingHorizontal: theme.spacing['2xsPlus'],
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The badge's own height as the line, so the digit sits at its centre rather
  // than where the role's taller line would put it.
  badgeText: {
    fontSize: theme.fonts.size['3xs'],
    fontWeight: theme.fonts.weight.bold,
    lineHeight: theme.spacing.md,
    textAlign: 'center',
    includeFontPadding: false,
  },
}));
