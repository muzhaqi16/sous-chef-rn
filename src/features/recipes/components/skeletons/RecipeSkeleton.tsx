import React from 'react';
import { View, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { RecipeItemSkeleton } from './RecipeItemSkeleton';

const ITEM_COUNT = 10;

/**
 * Skeleton for the RecipeMain item list only.
 *
 * The SearchBar is rendered as a real component in the DeferredScreen fallback,
 * so this skeleton only covers the item rows.
 */
export const RecipeSkeleton: React.FC = () => (
  <ScrollView
    contentContainerStyle={styles.container}
    showsVerticalScrollIndicator={false}
  >
    <View style={styles.itemList}>
      {Array.from({ length: ITEM_COUNT }, (_, index) => (
        <RecipeItemSkeleton key={index} />
      ))}
    </View>
  </ScrollView>
);

const styles = StyleSheet.create(theme => ({
  container: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  itemList: {
    gap: theme.spacing.sm,
  },
}));
