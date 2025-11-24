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
  onConsume?: () => void;
  onWaste?: () => void;
  onSwipeableWillOpen?: (ref: any) => void;
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  };
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode; // Optional left element for image or icon
  testID?: string;
}

const ItemCardComponent: React.FC<ItemCardProps> = ({
  title,
  subtitle,
  onPress,
  onEdit,
  onDelete,
  onConsume,
  onWaste,
  onSwipeableWillOpen,
  badge,
  rightElement,
  leftElement,
  testID,
}) => {
  const innerContent =
    onEdit || onDelete || onConsume || onWaste ? (
      <SwipeableItem
        onPress={onPress}
        onEdit={onEdit}
        onDelete={onDelete}
        onConsume={onConsume}
        onWaste={onWaste}
        onSwipeableWillOpen={onSwipeableWillOpen}
        testIDPrefix={testID}
      >
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

  return (
    <View style={[commonStyles.shadow, styles.container]} testID={testID}>{innerContent}</View>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const ItemCard = React.memo(ItemCardComponent);

const styles = StyleSheet.create(theme => ({
  container: {
    opacity: 1, // Prevent TouchableOpacity transparency inheritance
    // Horizontal margin for shadow visibility
    marginHorizontal: theme.spacing.sm,
    // Half vertical margin so stacked items merge to full spacing (md/2 + md/2 = md)
    marginVertical: theme.spacing.sm,
    borderRadius: 12,
    boxSizing: 'border-box',
  },
}));
