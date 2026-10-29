import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#components/atoms/Icon';
import { hitSlop } from '#/theme/foundations/sizes';

interface QuickAddButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
}

/** A suggestion row's trailing +: adds the item without opening a form. */
export const QuickAddButton: React.FC<QuickAddButtonProps> = ({
  onPress,
  accessibilityLabel,
}) => (
  <AppPressable
    style={styles.button}
    onPress={onPress}
    hitSlop={hitSlop.md}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
  >
    <Icon name="add" size={20} tone="primary" />
  </AppPressable>
);

const styles = StyleSheet.create(theme => ({
  button: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
