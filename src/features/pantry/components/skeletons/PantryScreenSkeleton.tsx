import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { PantryItemSkeleton } from '#features/pantry/components/skeletons/PantryItemSkeleton';

const ITEM_COUNT = 10;

/**
 * Skeleton for the PantryContent list portion.
 *
 * The list's header renders as the FlashList's ListHeaderComponent and stays
 * visible during loading. This skeleton is rendered as ListEmptyComponent,
 * covering only the item rows below the header.
 */
export const PantryScreenSkeleton: React.FC = () => (
  <View testID="pantry-loading" style={styles.container}>
    {Array.from({ length: ITEM_COUNT }, (_, index) => (
      <PantryItemSkeleton key={index} />
    ))}
  </View>
);

const styles = StyleSheet.create(theme => ({
  container: {
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
}));
