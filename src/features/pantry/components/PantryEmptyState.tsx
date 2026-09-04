import React from 'react';
import { useTranslation } from '#/i18n';
import { EmptyState } from '#components/molecules/EmptyState';
import { PantryScreenSkeleton } from '#features/pantry/components/skeletons/PantryScreenSkeleton';
import { EMPTY_STATE_MIN_HEIGHT } from './pantryDisplay/constants';
import type { PantryEmptyStateProps } from './pantryDisplay/types';
import { StyleSheet } from 'react-native-unistyles';

export function PantryEmptyState({
  showSkeletons,
  searchQuery,
  itemCount,
  locationFilter,
  tabs,
  onAddItem,
  noHomeSelected,
  noHomes,
  noPantries,
  onSelectHome,
  onCreatePantry,
  overallItemCount,
}: PantryEmptyStateProps) {
  const { t } = useTranslation();

  if (showSkeletons) return <PantryScreenSkeleton />;

  if (noHomes) {
    return (
      <EmptyState
        testID="pantry-empty-state"
        icon="home-outline"
        title={t('pantryScreen.noHomeTitle')}
        description={t('pantryScreen.noHomeDescription')}
        style={styles.emptyState}
        action={
          onSelectHome
            ? {
                label: t('labels.getStarted'),
                onPress: onSelectHome,
              }
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
        title={t('errors.noHomeSelected')}
        description={t('pantryScreen.noHomeSelectedDescription')}
        style={styles.emptyState}
        action={
          onSelectHome
            ? {
                label: t('pantryScreen.noHomeSelectedAction'),
                onPress: onSelectHome,
              }
            : undefined
        }
      />
    );
  }

  if (noPantries) {
    return (
      <EmptyState
        testID="pantry-empty-state"
        icon="basket-outline"
        title={t('pantryScreen.noPantriesTitle')}
        description={t('pantryScreen.noPantriesDescription')}
        style={styles.emptyState}
        action={
          onCreatePantry
            ? {
                label: t('pantryScreen.noPantriesAction'),
                onPress: onCreatePantry,
              }
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
        title={t('empty.noResultsFor', { query: displayQuery })}
        description={t('pantryScreen.searchNoResultsDescription')}
        style={styles.emptyState}
        action={
          onAddItem
            ? {
                label: t('labels.addItem'),
                onPress: onAddItem,
              }
            : undefined
        }
      />
    );
  }

  if (locationFilter !== 'all' && itemCount === 0 && overallItemCount > 0) {
    const activeTab = tabs.find(tab => tab.id === locationFilter);
    const tabName = activeTab?.label ?? t('pantryScreen.tabEmptyFallbackName');
    return (
      <EmptyState
        testID="pantry-empty-state"
        icon="basket-outline"
        title={t('pantryScreen.tabEmptyTitle', { tabName })}
        description={t('pantryScreen.tabEmptyDescription')}
        style={styles.emptyState}
      />
    );
  }

  return (
    <EmptyState
      testID="pantry-empty-state"
      icon="basket-outline"
      title={t('empty.noPantryItems')}
      description={t('pantryScreen.emptySubtitle')}
      style={styles.emptyState}
      action={
        onAddItem
          ? { label: t('labels.addItems'), onPress: onAddItem }
          : undefined
      }
    />
  );
}

// Every branch is the same height, so the list does not jump as the reason for
// being empty changes.
const styles = StyleSheet.create({
  emptyState: {
    minHeight: EMPTY_STATE_MIN_HEIGHT,
  },
});
