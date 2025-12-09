import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export type LocationFilter = 'all' | 'fridge' | 'freezer' | 'pantry';

interface FilterConfig {
  id: LocationFilter;
  label: string;
  icon: string;
}

const FILTER_CONFIGS: FilterConfig[] = [
  { id: 'all', label: 'All', icon: '📦' },
  { id: 'fridge', label: 'Fridge', icon: '🧊' },
  { id: 'freezer', label: 'Freezer', icon: '❄️' },
  { id: 'pantry', label: 'Pantry', icon: '🏪' },
];

interface PantryLocationTabsProps {
  activeFilter: LocationFilter;
  onFilterChange: (filter: LocationFilter) => void;
  counts: {
    all: number;
    fridge: number;
    freezer: number;
    pantry: number;
  };
}

export const PantryLocationTabs: React.FC<PantryLocationTabsProps> = ({
  activeFilter,
  onFilterChange,
  counts,
}) => {
  const { theme } = useUnistyles();

  const handleFilterPress = useCallback(
    (filterId: LocationFilter) => {
      onFilterChange(filterId);
    },
    [onFilterChange],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {FILTER_CONFIGS.map(config => {
          const isActive = activeFilter === config.id;
          const count = counts[config.id];

          return (
            <Pressable
              key={config.id}
              onPress={() => handleFilterPress(config.id)}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive
                    ? theme.colors.filterTab.activeBg
                    : theme.colors.filterTab.inactiveBg,
                },
              ]}
            >
              <Text style={styles.tabIcon}>{config.icon}</Text>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive
                      ? theme.colors.filterTab.activeText
                      : theme.colors.filterTab.inactiveText,
                  },
                ]}
              >
                {config.label}
              </Text>
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: isActive
                      ? theme.colors.filterTab.activeCountBg
                      : theme.colors.filterTab.countBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    {
                      color: isActive
                        ? theme.colors.filterTab.activeText
                        : theme.colors.filterTab.countText,
                    },
                  ]}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    paddingVertical: theme.spacing.md,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  tabIcon: {
    fontSize: 14,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: theme.fonts.weight.semibold,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    fontWeight: theme.fonts.weight.bold,
  },
}));
