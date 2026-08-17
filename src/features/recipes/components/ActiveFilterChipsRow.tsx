import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { Icon } from '#/utils/iconUtils';
import type { RecipeFilters } from '#features/recipes/utils/recipeFilterMaps';
import {
  DIET_OPTIONS,
  INTOLERANCE_OPTIONS,
  MEAL_TYPES,
  filterOptionLabelKey,
} from '#features/recipes/utils/recipeFilterOptions';

export type RemovableFilterKind =
  | 'diet'
  | 'intolerance'
  | 'mealType'
  | 'maxReadyTime';

interface ActiveFilterChipsRowProps {
  filters: RecipeFilters;
  onRemoveFilter: (kind: RemovableFilterKind, value?: string) => void;
  onClearAll: () => void;
}

interface ChipDescriptor {
  key: string;
  label: string;
  kind: RemovableFilterKind;
  value?: string;
}

/**
 * Compact indicator for the filters currently applied to recipe searches.
 * Dietary-profile filters are auto-applied silently, so this row is the
 * visible answer to "why am I getting so few results?".
 *
 * Collapsed by default to a one-line summary ("6 filters active"); tapping it
 * expands a horizontal row of removable chips — each chip removes one filter
 * (re-running the active search), and Clear resets them all.
 */
export const ActiveFilterChipsRow: React.FC<ActiveFilterChipsRowProps> = ({
  filters,
  onRemoveFilter,
  onClearAll,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const chips: ChipDescriptor[] = [
    ...filters.diet.map(
      (value): ChipDescriptor => ({
        key: `diet-${value}`,
        label: t(filterOptionLabelKey(DIET_OPTIONS, value)),
        kind: 'diet',
        value,
      }),
    ),
    ...filters.intolerances.map(
      (value): ChipDescriptor => ({
        key: `intolerance-${value}`,
        label: t(filterOptionLabelKey(INTOLERANCE_OPTIONS, value)),
        kind: 'intolerance',
        value,
      }),
    ),
    ...(filters.mealType
      ? [
          {
            key: `mealType-${filters.mealType}`,
            label: t(filterOptionLabelKey(MEAL_TYPES, filters.mealType)),
            kind: 'mealType',
          } satisfies ChipDescriptor,
        ]
      : []),
    ...(filters.maxReadyTime
      ? [
          {
            key: `maxReadyTime-${filters.maxReadyTime}`,
            label: t('recipes.maxTimeChip', { count: filters.maxReadyTime }),
            kind: 'maxReadyTime',
          } satisfies ChipDescriptor,
        ]
      : []),
  ];

  if (chips.length === 0) return null;

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.summaryRow, pressed && styles.pressed]}
        onPress={() => setExpanded(prev => !prev)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t('recipes.filtersActiveSummary', {
          count: chips.length,
        })}
        testID="active-filters-summary"
      >
        <Icon name="options-outline" size={14} tone="primary" />
        <Text size="sm" weight="semibold" tone="secondary">
          {t('recipes.filtersActiveSummary', { count: chips.length })}
        </Text>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          tone="textSecondary"
        />
      </Pressable>
      {expanded ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {chips.map(chip => (
            <Pressable
              key={chip.key}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              onPress={() => onRemoveFilter(chip.kind, chip.value)}
              accessibilityRole="button"
              accessibilityLabel={t('recipes.removeFilterA11y', {
                filter: chip.label,
              })}
            >
              <Text size="sm" weight="semibold" style={styles.chipText}>
                {chip.label}
              </Text>
              {/* textInverse tracks chipSelectedText (neutral-0 light / neutral-900 dark) */}
              <Icon name="close-circle" size={16} tone="textInverse" />
            </Pressable>
          ))}
          <Pressable
            style={({ pressed }) => [
              styles.clearAllButton,
              pressed && styles.pressed,
            ]}
            onPress={onClearAll}
            accessibilityRole="button"
            accessibilityLabel={t('recipeFilters.clearAllA11y')}
          >
            <Text size="sm" weight="semibold" tone="secondary">
              {t('recipeFilters.clear')}
            </Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginTop: theme.spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing['3'],
  },
  scrollContent: {
    paddingHorizontal: theme.spacing['3'],
    paddingBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm + 2,
    borderRadius: theme.radii['2xl'],
    borderCurve: 'continuous',
    backgroundColor: theme.colors.chipSelectedBackground,
  },
  chipText: {
    color: theme.colors.chipSelectedText,
  },
  clearAllButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
