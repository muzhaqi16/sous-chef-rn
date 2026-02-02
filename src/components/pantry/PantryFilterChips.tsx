import React, { useCallback, useMemo } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Chip from '../atoms/Chip';

export type FilterType =
  | 'expiring'
  | 'expired'
  | 'lowStock'
  | 'refrigerated'
  | 'frozen';

interface FilterConfig {
  id: FilterType;
  label: string;
  color: string;
}

interface PantryFilterChipsProps {
  activeFilters: Set<FilterType>;
  onFilterChange: (filters: Set<FilterType>) => void;
  stats: {
    expired: number;
    expiringSoon: number;
    lowStock: number;
  };
  storageCounts?: {
    refrigerated: number;
    frozen: number;
  };
}

export const PantryFilterChips: React.FC<PantryFilterChipsProps> = ({
  activeFilters,
  onFilterChange,
  stats,
  storageCounts,
}) => {
  const { theme } = useUnistyles();

  const filterConfigs = useMemo<FilterConfig[]>(
    () => [
      { id: 'expiring', label: 'Expiring', color: theme.colors.warning },
      { id: 'expired', label: 'Expired', color: theme.colors.error },
      { id: 'lowStock', label: 'Low Stock', color: theme.colors.warning },
      { id: 'refrigerated', label: 'Refrigerated', color: theme.colors.info },
      { id: 'frozen', label: 'Frozen', color: theme.colors.primary },
    ],
    [theme.colors],
  );

  // Pre-compute badge styles to avoid inline object creation
  const badgeStyles = useMemo(
    () =>
      filterConfigs.reduce(
        (acc, config) => {
          acc[config.id] = [styles.badge, { backgroundColor: config.color }];
          return acc;
        },
        {} as Record<FilterType, (typeof styles.badge | { backgroundColor: string })[]>,
      ),
    [filterConfigs],
  );

  const getFilterCount = useCallback(
    (filterId: FilterType): number => {
      switch (filterId) {
        case 'expiring':
          return stats.expiringSoon;
        case 'expired':
          return stats.expired;
        case 'lowStock':
          return stats.lowStock;
        case 'refrigerated':
          return storageCounts?.refrigerated ?? 0;
        case 'frozen':
          return storageCounts?.frozen ?? 0;
        default:
          return 0;
      }
    },
    [stats, storageCounts],
  );

  const handleFilterToggle = useCallback(
    (filterId: FilterType) => {
      const newFilters = new Set(activeFilters);
      if (newFilters.has(filterId)) {
        newFilters.delete(filterId);
      } else {
        newFilters.add(filterId);
      }
      onFilterChange(newFilters);
    },
    [activeFilters, onFilterChange],
  );

  // Only show filters that have items - memoized to avoid re-filtering on every render
  const visibleFilters = useMemo(
    () => filterConfigs.filter(config => getFilterCount(config.id) > 0),
    [filterConfigs, getFilterCount],
  );

  // Don't render anything if no filters have items
  if (visibleFilters.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {visibleFilters.map(config => {
          const count = getFilterCount(config.id);
          const isSelected = activeFilters.has(config.id);

          return (
            <View key={config.id} style={styles.chipWrapper}>
              <Chip
                label={`${config.label} (${count})`}
                selected={isSelected}
                onPress={() => handleFilterToggle(config.id)}
              />
              {isSelected && count > 0 && (
                <View style={badgeStyles[config.id]}>
                  <Text style={styles.badgeText}>{count}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    paddingVertical: theme.spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
  },
  chipWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -theme.spacing.xs,
    right: theme.spacing.xs,
    minWidth: theme.spacing.lg - 6,
    height: theme.spacing.lg - 6,
    borderRadius: theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs - 2,
    fontWeight: '700',
  },
}));
