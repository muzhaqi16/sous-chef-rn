import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { Icon } from '#components/atoms/Icon';
import type { RecipeFilters } from '#features/recipes/utils/recipeFilterOptions';
import {
  DIET_OPTIONS,
  INTOLERANCE_OPTIONS,
  MEAL_TYPES,
  filterOptionLabelKey,
  type RecipeFilterOption,
} from '#features/recipes/utils/recipeFilterOptions';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { ExpandChevron } from '#components/atoms/ExpandChevron';
import { Chip } from '#components/molecules/Chip';

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
 * The filters currently applied to recipe searches. Dietary-profile filters are
 * auto-applied silently, so this row is the visible answer to "why am I getting
 * so few results?". Collapsed to a summary until tapped.
 */
export const ActiveFilterChipsRow: React.FC<ActiveFilterChipsRowProps> = ({
  filters,
  onRemoveFilter,
  onClearAll,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  // A value no option lists (an enum member added after this build) shows as written.
  const labelFor = <V extends string>(
    options: readonly RecipeFilterOption<V>[],
    value: V,
  ) => {
    const labelKey = filterOptionLabelKey(options, value);
    return labelKey ? t(labelKey) : value;
  };

  const chips: ChipDescriptor[] = [
    ...filters.diet.map(
      (value): ChipDescriptor => ({
        key: `diet-${value}`,
        label: labelFor(DIET_OPTIONS, value),
        kind: 'diet',
        value,
      }),
    ),
    ...filters.intolerances.map(
      (value): ChipDescriptor => ({
        key: `intolerance-${value}`,
        label: labelFor(INTOLERANCE_OPTIONS, value),
        kind: 'intolerance',
        value,
      }),
    ),
    ...(filters.mealType
      ? [
          {
            key: `mealType-${filters.mealType}`,
            label: labelFor(MEAL_TYPES, filters.mealType),
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
        testID={recipesTestIDs.activeFiltersSummary}
      >
        <Icon name="options-outline" size="2xsPlus" tone="primary" />
        <Text role="label" tone="secondary">
          {t('recipes.filtersActiveSummary', { count: chips.length })}
        </Text>
        <ExpandChevron expanded={expanded} size="2xsPlus" />
      </Pressable>
      {expanded ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {chips.map(chip => (
            <Chip
              key={chip.key}
              label={chip.label}
              removable
              onPress={() => onRemoveFilter(chip.kind, chip.value)}
              accessibilityLabel={t('recipes.removeFilterA11y', {
                filter: chip.label,
              })}
            />
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
            <Text role="label" tone="secondary">
              {t('labels.clear')}
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
    paddingHorizontal: theme.spacing.base,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  clearAllButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
