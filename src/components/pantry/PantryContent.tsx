import React from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { ItemList } from '#components/organisms/ItemList';
import { PantryItemSkeleton } from '#components/base/Skeleton';

interface PantryContentProps {
  items: any[];
  loading?: boolean;
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onItemConsume?: (id: string) => void;
  onItemWaste?: (id: string) => void;
  onItemRestock?: (id: string) => void;
  onRefresh?: () => Promise<void>;
  onSwipeableWillOpen?: (ref: any) => void;
  emptyState?: any;
}

/**
 * Wrapper component that shows skeleton screens during loading
 *
 * Handles two states:
 * 1. Loading with no items - shows skeleton screens
 * 2. Has items or not loading - shows ItemList with items/empty state
 */
const SKELETON_KEYS = [1, 2, 3, 4, 5];

export const PantryContent: React.FC<PantryContentProps> = ({
  items,
  loading,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onItemConsume,
  onItemWaste,
  onItemRestock,
  onRefresh,
  onSwipeableWillOpen,
  emptyState,
}) => {
  // Show skeleton screens during initial load
  if (loading && items.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.skeletonContainer}>
        {SKELETON_KEYS.map(key => (
          <PantryItemSkeleton key={key} />
        ))}
      </ScrollView>
    );
  }

  // Otherwise show the normal ItemList
  return (
    <ItemList
      items={items}
      onItemPress={onItemPress}
      onItemEdit={onItemEdit}
      onItemDelete={onItemDelete}
      onItemConsume={onItemConsume}
      onItemWaste={onItemWaste}
      onItemRestock={onItemRestock}
      onRefresh={onRefresh}
      onSwipeableWillOpen={onSwipeableWillOpen}
      emptyState={emptyState}
    />
  );
};

const styles = StyleSheet.create(() => ({
  skeletonContainer: {
    padding: 16,
    gap: 8,
  },
}));
