import React from 'react';
import {SwipeableItem} from '#components';
import {ListItem} from '../molecules/ListItem';

interface ItemCardProps {
  id: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  };
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode; // Optional left element for image or icon
}

export const ItemCard: React.FC<ItemCardProps> = ({
  title,
  subtitle,
  onPress,
  onEdit,
  onDelete,
  badge,
  rightElement,
  leftElement,
}) => {
  if (onEdit || onDelete) {
    return (
      <SwipeableItem onPress={onPress} onEdit={onEdit} onDelete={onDelete}>
        <ListItem
          title={title}
          subtitle={subtitle}
          badge={badge}
          rightElement={rightElement}
          leftElement={leftElement}
        />
      </SwipeableItem>
    );
  }

  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      onPress={onPress}
      badge={badge}
      rightElement={rightElement}
    />
  );
};
