import React from 'react';
import { View, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ShoppingListItemSkeleton } from './ShoppingListItemSkeleton';

const ITEM_COUNT = 10;

/**
 * Skeleton for the ShoppingList item list only.
 *
 * The SearchBar and FilterTabBar are sticky elements rendered outside the
 * scrollable list, so the skeleton only covers the item rows.
 */
export const ShoppingListSkeleton: React.FC = () => (
  <ScrollView
    contentContainerStyle={styles.container}
    showsVerticalScrollIndicator={false}
  >
    <View style={styles.itemList}>
      {Array.from({ length: ITEM_COUNT }, (_, index) => (
        <ShoppingListItemSkeleton key={index} />
      ))}
    </View>
  </ScrollView>
);

const styles = StyleSheet.create(theme => ({
  container: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  itemList: {
    gap: theme.spacing.sm,
  },
}));
