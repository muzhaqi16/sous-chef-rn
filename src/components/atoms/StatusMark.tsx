import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon, type IconName } from '#components/atoms/Icon';

interface StatusMarkProps {
  /** Hidden without one. */
  icon: IconName | undefined;
}

/**
 * A state glyph over a control's top-right corner, such as a photo pending
 * review on the control that acts on it. Its parent positions it, so it sits
 * inside a view with no clip.
 */
export const StatusMark: React.FC<StatusMarkProps> = ({ icon }) =>
  icon ? (
    <View style={styles.mark} pointerEvents="none">
      <Icon name={icon} size={MARK_GLYPH} tone="onWarning" />
    </View>
  ) : null;

// Smaller than any icon step: the mark is a corner of a 24pt glyph's target.
const MARK_GLYPH = 11;

const styles = StyleSheet.create(theme => ({
  mark: {
    position: 'absolute',
    top: -theme.spacing['2xs'],
    right: -theme.spacing['2xs'],
    width: theme.spacing.md,
    height: theme.spacing.md,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
