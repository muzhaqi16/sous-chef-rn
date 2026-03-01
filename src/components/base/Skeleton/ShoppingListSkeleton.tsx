import React from 'react';
import { View, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonBase } from './SkeletonBase';
import { ShoppingListItemSkeleton } from './ShoppingListItemSkeleton';

const ITEM_COUNT = 10;

/**
 * Full-screen skeleton for ShoppingListMain.
 *
 * Replicates the loaded layout: search bar, filter tab pills, and item list
 * so the skeleton matches what the user sees after data loads.
 */
export const ShoppingListSkeleton: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    {/* Search bar skeleton — matches BaseInput (minHeight 44, borderRadius md) */}
    <View style={styles.searchBarContainer}>
      <SkeletonBase width="100%" height={44} borderRadius={8} />
    </View>

    {/* Tab pills row — matches FilterTabBar layout */}
    <View style={styles.tabRow}>
      <View style={styles.tabPillsRow}>
        {/* "Shopping" pill with count badge */}
        <View style={styles.tabPill}>
          <SkeletonBase width={62} height={14} borderRadius={4} />
          <SkeletonBase width={22} height={18} borderRadius={8} />
        </View>
        {/* "Purchased" pill with count badge */}
        <View style={styles.tabPill}>
          <SkeletonBase width={68} height={14} borderRadius={4} />
          <SkeletonBase width={22} height={18} borderRadius={8} />
        </View>
      </View>
      {/* "Clear" button skeleton */}
      <SkeletonBase width={38} height={14} borderRadius={4} />
    </View>

    {/* Item list */}
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
  searchBarContainer: {
    // Matches the searchBarContainer in ShoppingListMain (paddingHorizontal only,
    // but here we're already inside container padding so no extra needed)
  },
  tabRow: {
    // Matches FilterTabBar container layout
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  tabPillsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  tabPill: {
    // Matches FilterTabItem styling
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing['3'] + 2,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.xl,
    backgroundColor: theme.colors.surfaceVariant,
  },
  itemList: {
    gap: theme.spacing.sm,
  },
}));
