import React from 'react';
import { EmptyState } from '#components/base/EmptyState';
import { PantryScreenSkeleton } from '#components/base/Skeleton/PantryScreenSkeleton';
import { EMPTY_STATE_MIN_HEIGHT } from './pantryDisplay/constants';
import type { PantryEmptyStateProps } from './pantryDisplay/types';

export function PantryEmptyState({
  showSkeletons,
  searchQuery,
  itemCount,
  locationFilter,
  tabs,
  onAddItem,
  noHomeSelected,
  noHomes,
  onSelectHome,
  overallItemCount,
}: PantryEmptyStateProps) {
  if (showSkeletons) return <PantryScreenSkeleton />;

  if (noHomes) {
    return (
      <EmptyState
        testID="pantry-empty-state"
        icon="home-outline"
        title="No home yet"
        description="Create or join a home to start tracking food"
        style={{ minHeight: EMPTY_STATE_MIN_HEIGHT }}
        action={
          onSelectHome
            ? { label: 'Get Started', onPress: onSelectHome }
            : undefined
        }
      />
    );
  }

  if (noHomeSelected) {
    return (
      <EmptyState
        testID="pantry-empty-state"
        icon="home-outline"
        title="No home selected"
        description="Select a home to view your pantry"
        style={{ minHeight: EMPTY_STATE_MIN_HEIGHT }}
        action={
          onSelectHome
            ? { label: 'Go to My Homes', onPress: onSelectHome }
            : undefined
        }
      />
    );
  }

  if (searchQuery) {
    const displayQuery =
      searchQuery.length > 30 ? searchQuery.slice(0, 30) + '...' : searchQuery;
    return (
      <EmptyState
        testID="pantry-empty-state"
        icon="search-outline"
        title={`No results for "${displayQuery}"`}
        description="Would you like to add it to your pantry?"
        style={{ minHeight: EMPTY_STATE_MIN_HEIGHT }}
        action={
          onAddItem ? { label: 'Add Item', onPress: onAddItem } : undefined
        }
      />
    );
  }

  if (locationFilter !== 'all' && itemCount === 0 && overallItemCount > 0) {
    const activeTab = tabs.find(tab => tab.id === locationFilter);
    const tabName = activeTab?.label ?? 'this location';
    return (
      <EmptyState
        testID="pantry-empty-state"
        icon="basket-outline"
        title={`No items in ${tabName}`}
        description="Items stored here will appear in this tab"
        style={{ minHeight: EMPTY_STATE_MIN_HEIGHT }}
      />
    );
  }

  return (
    <EmptyState
      testID="pantry-empty-state"
      icon="basket-outline"
      title="Your pantry is empty"
      description="Start tracking your food to reduce waste"
      style={{ minHeight: EMPTY_STATE_MIN_HEIGHT }}
      action={
        onAddItem ? { label: 'Add Items', onPress: onAddItem } : undefined
      }
    />
  );
}
