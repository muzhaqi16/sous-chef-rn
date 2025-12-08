import React, { useCallback } from 'react';
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

  const filterConfigs: FilterConfig[] = [
    { id: 'expiring', label: 'Expiring', color: theme.colors.warning },
    { id: 'expired', label: 'Expired', color: theme.colors.error },
    { id: 'lowStock', label: 'Low Stock', color: theme.colors.warning },
    { id: 'refrigerated', label: 'Refrigerated', color: theme.colors.info },
    { id: 'frozen', label: 'Frozen', color: theme.colors.primary },
  ];

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

  // Only show filters that have items
  const visibleFilters = filterConfigs.filter(
    config => getFilterCount(config.id) > 0,
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
                <View
                  style={[styles.badge, { backgroundColor: config.color }]}
                >
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
    top: -4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
}));
