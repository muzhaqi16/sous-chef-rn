import React from 'react';
import { IconButton } from '#components/atoms/IconButton';
import { StyleSheet } from 'react-native-unistyles';

interface QuickAddButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}

/** A suggestion row's trailing +: adds the item without opening a form. */
export const QuickAddButton: React.FC<QuickAddButtonProps> = ({
  onPress,
  accessibilityLabel,
  testID,
}) => (
  <IconButton
    name="add"
    size="sm"
    tone="primary"
    onPress={onPress}
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    testID={testID}
    style={styles.button}
  />
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
