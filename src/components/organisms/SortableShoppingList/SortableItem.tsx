import React from 'react';
import { View, TouchableOpacity, Vibration, Platform } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SwipeableItem } from '#/components/molecules/SwipeableItem';
import { ListItem } from '#/components/molecules/ListItem';
import { commonStyles } from '#/styles';

interface SimpleDraggableItemProps {
  item: {
    id: string;
    title: string;
    subtitle: string;
    badge?: {
      text: string;
      variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
    };
    rightElement?: React.ReactNode;
    leftElement?: React.ReactNode;
  };
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  drag?: () => void;
  isActive?: boolean;
}

export const SimpleDraggableItem: React.FC<SimpleDraggableItemProps> = ({
  item,
  onItemPress,
  onItemEdit,
  onItemDelete,
  drag,
  isActive,
}) => {
  // Handle drag activation with haptic feedback
  const handleDragStart = () => {
    if (drag) {
      // Provide haptic feedback when drag activates
      if (Platform.OS === 'ios') {
        Vibration.vibrate(100);
      } else {
        // Android allows pattern vibration
        Vibration.vibrate(100);
      }
      drag();
    }
  };

  // Combine the original rightElement with the drag handle
  const rightElement = (
    <View style={styles.rightContainer}>
      {item.rightElement}
      {drag && (
        <TouchableOpacity
          onLongPress={handleDragStart}
          delayLongPress={150}
          style={styles.dragHandle}
        >
          <View style={styles.dragIcon}>
            <View style={styles.dragLine} />
            <View style={styles.dragLine} />
            <View style={styles.dragLine} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, isActive && styles.activeContainer]}>
      <SwipeableItem
        onPress={() => onItemPress(item.id)}
        onEdit={onItemEdit ? () => onItemEdit(item.id) : undefined}
        onDelete={onItemDelete ? () => onItemDelete(item.id) : undefined}
        friction={1}
      >
        <ListItem
          title={item.title}
          subtitle={item.subtitle}
          badge={item.badge}
          rightElement={rightElement}
          leftElement={item.leftElement}
          rightIcon={undefined}
        />
      </SwipeableItem>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    ...commonStyles.shadow,
    opacity: 1,
    // Horizontal margin for shadow visibility
    marginHorizontal: theme.spacing.sm,
    // Vertical margin for consistent spacing between items
    marginVertical: theme.spacing.sm,
    borderRadius: 12,
  },
  activeContainer: {
    opacity: 0.98,
    // Enhanced shadow when dragging for visual feedback
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dragHandle: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragIcon: {
    width: 20,
    gap: 3,
  },
  dragLine: {
    height: 2,
    backgroundColor: '#999',
    borderRadius: 1,
  },
}));
