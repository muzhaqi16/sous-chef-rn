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
  // Mirrors the real list's own content inset, so a skeleton row lands exactly
  // where the row it stands in for will.
  container: {
    paddingHorizontal: theme.layout.pageGutter,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
}));
