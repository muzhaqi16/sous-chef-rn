import React from 'react';
import { RowCard } from '#components/atoms/RowCard';
import { ListItem } from '#components/molecules/ListItem';
import { Icon } from '#components/atoms/Icon';

export interface FolderListItemProps {
  /** Null is the "no folder" choice, named by `label`. */
  folder: string | null;
  label?: string;
  isSelected: boolean;
  onPress: (folder: string | null) => void;
  /** When provided, enables the long-press manage menu. */
  onLongPress?: (folder: string) => void;
}

/**
 * Single selectable folder row used by {@link FolderPicker}'s list. Purely
 * presentational — all selection / long-press orchestration lives in the
 * parent picker.
 */
export const FolderListItem: React.FC<FolderListItemProps> = ({
  folder,
  label,
  isSelected,
  onPress,
  onLongPress,
}) => {
  return (
    <RowCard>
      <ListItem
        leftIcon="folder-outline"
        title={label ?? folder ?? ''}
        titleNumberOfLines={1}
        onPress={() => onPress(folder)}
        onLongPress={
          onLongPress && folder !== null ? () => onLongPress(folder) : undefined
        }
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
