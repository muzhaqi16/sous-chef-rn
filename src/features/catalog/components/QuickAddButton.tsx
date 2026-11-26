import React from 'react';
import { IconButton } from '#components/atoms/IconButton';

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
    filled={{ size: 'md', tone: 'primaryLight' }}
  />
);
