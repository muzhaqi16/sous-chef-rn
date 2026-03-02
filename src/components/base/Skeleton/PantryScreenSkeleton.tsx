import React from 'react';
import { View, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonBase } from './SkeletonBase';
import { PantryItemSkeleton } from './PantryItemSkeleton';

const ITEM_COUNT = 10;

/**
 * Skeleton for the PantryContent list portion.
 *
 * SearchBar, AlertBar, and FilterTabs are rendered outside the FlashList
 * (always visible as sticky elements), so this skeleton only covers the
 * section header and item list that appear inside the scrollable area.
 */
export const PantryScreenSkeleton: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    {/* Section header skeleton — matches SectionHeader layout */}
    <View style={styles.sectionHeader}>
      <SkeletonBase width={100} height={13} borderRadius={4} />
      <SkeletonBase width={50} height={13} borderRadius={4} />
    </View>

    {/* Item list */}
    {Array.from({ length: ITEM_COUNT }, (_, index) => (
      <PantryItemSkeleton key={index} />
    ))}
  </ScrollView>
);

const styles = StyleSheet.create(theme => ({
  container: {
    paddingTop: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
}));
