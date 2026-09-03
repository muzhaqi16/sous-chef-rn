import React from 'react';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

export interface FolderListItemProps {
  folder: string;
  isSelected: boolean;
  onPress: (folder: string) => void;
  /** When provided, enables the long-press manage menu. */
  onLongPress?: (folder: string) => void;
  disabled?: boolean;
}

/**
 * Single selectable folder row used by {@link FolderPicker}'s list. Purely
 * presentational — all selection / long-press orchestration lives in the
 * parent picker.
 */
export const FolderListItem: React.FC<FolderListItemProps> = ({
  folder,
  isSelected,
  onPress,
  onLongPress,
  disabled = false,
}) => {
  return (
    <AppPressable
      style={[styles.folderItem, isSelected && styles.folderItemSelected]}
      onPress={() => onPress(folder)}
      onLongPress={onLongPress ? () => onLongPress(folder) : undefined}
      delayLongPress={500}
      disabled={disabled}
    >
      <Icon
        name="folder-outline"
        size={20}
        tone={isSelected ? 'primary' : 'textSecondary'}
      />
      <Text
        size="base"
        weight={isSelected ? 'semibold' : 'regular'}
        tone={isSelected ? 'accent' : 'primary'}
        style={styles.folderName}
        numberOfLines={1}
      >
        {folder}
      </Text>
      {!!isSelected && <Icon name="checkmark" size={20} tone="primary" />}
    </AppPressable>
  );
};

const styles = StyleSheet.create(theme => ({
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    gap: theme.spacing.base,
  },
  folderItemSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  folderName: {
    flex: 1,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
