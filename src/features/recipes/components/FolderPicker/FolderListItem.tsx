import React from 'react';
import { RowCard } from '#components/atoms/RowCard';
import { ListItem } from '#components/molecules/ListItem';
import { Icon } from '#components/atoms/Icon';

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
    <RowCard>
      <ListItem
        leftIcon="folder-outline"
        title={folder}
        titleNumberOfLines={1}
        onPress={() => onPress(folder)}
        onLongPress={onLongPress ? () => onLongPress(folder) : undefined}
        disabled={disabled}
        selected={isSelected}
        rightElement={
          isSelected ? <Icon name="checkmark" size="sm" tone="primary" /> : null
        }
        // Its label is the folder; the tap picks it.
        accessibilityHint=""
      />
    </RowCard>
  );
};
