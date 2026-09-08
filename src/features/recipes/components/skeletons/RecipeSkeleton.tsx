import React from 'react';
import { ScrollView } from 'react-native';
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
    {Array.from({ length: ITEM_COUNT }, (_, index) => (
      <RecipeItemSkeleton key={index} />
    ))}
  </ScrollView>
);

const styles = StyleSheet.create(theme => ({
  // No horizontal inset: of its three hosts two already sit inside a
  // gutter-padded container, so carrying one here double-insets them.
  container: {
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
}));
