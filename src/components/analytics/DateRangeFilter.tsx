import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, ScrollView } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { DateRange } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';

interface DateRangeOption {
  value: DateRange;
  /** i18n key path — the options array is module-level, so no hook. */
  labelKey: string;
}

const DATE_RANGE_OPTIONS: DateRangeOption[] = [
  { value: DateRange.LastWeek, labelKey: 'dateRange.week' },
  { value: DateRange.LastMonth, labelKey: 'dateRange.month' },
  { value: DateRange.LastQuarter, labelKey: 'dateRange.quarter' },
  { value: DateRange.LastYear, labelKey: 'dateRange.year' },
];

interface DateRangeFilterProps {
  selected: DateRange;
  onSelect: (range: DateRange) => void;
}

function DateRangeChip({
  option,
  isSelected,
  onPress,
}: {
  option: DateRangeOption;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  styles.useVariants({ selected: isSelected });
  return (
    <AppPressable onPress={onPress} style={styles.chip}>
      <Text size="sm" weight="medium" style={styles.chipText}>
        {t(option.labelKey)}
      </Text>
    </AppPressable>
  );
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  selected,
  onSelect,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {DATE_RANGE_OPTIONS.map(option => (
          <DateRangeChip
            key={option.value}
            option={option}
            isSelected={selected === option.value}
            onPress={() => onSelect(option.value)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginVertical: theme.spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.chipBackground,
    variants: {
      selected: {
        true: { backgroundColor: theme.colors.primary },
      },
    },
  },
  chipText: {
    color: theme.colors.chipText,
    variants: {
      selected: {
        true: { color: theme.colors.white },
      },
    },
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
