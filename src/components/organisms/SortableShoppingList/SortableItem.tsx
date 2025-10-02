import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { SwipeableItem } from '#/components/molecules/SwipeableItem';
import { ListItem } from '#/components/molecules/ListItem';

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
  // Combine the original rightElement with the drag handle
  const rightElement = (
    <View style={styles.rightContainer}>
      {item.rightElement}
      {drag && (
        <TouchableOpacity
          onLongPress={drag}
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

const styles = StyleSheet.create({
  container: {
    opacity: 1,
  },
  activeContainer: {
    opacity: 0.7,
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
});
