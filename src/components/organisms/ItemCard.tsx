import React from 'react';
import { View } from 'react-native';
import { SwipeableItem } from '#components';
import { ListItem } from '../molecules/ListItem';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles';

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
  const innerContent =
    onEdit || onDelete ? (
      <SwipeableItem onPress={onPress} onEdit={onEdit} onDelete={onDelete}>
        <ListItem
          title={title}
          subtitle={subtitle}
          badge={badge}
          rightElement={rightElement}
          leftElement={leftElement}
        />
      </SwipeableItem>
    ) : (
      <ListItem
        title={title}
        subtitle={subtitle}
        onPress={onPress}
        badge={badge}
        rightElement={rightElement}
        leftElement={leftElement}
      />
    );

  return <View style={styles.container}>{innerContent}</View>;
};

const styles = StyleSheet.create(theme => ({
  container: {
    ...commonStyles.shadow,
    // Horizontal margin for shadow visibility
    marginHorizontal: theme.spacing.sm,
    // Half vertical margin so stacked items merge to full spacing (md/2 + md/2 = md)
    marginVertical: theme.spacing.sm,
    borderRadius: 12,
    boxSizing: 'border-box',
  },
}));
