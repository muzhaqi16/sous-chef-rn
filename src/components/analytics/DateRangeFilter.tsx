import React from 'react';
import { View, ScrollView } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { DateRange } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';

interface DateRangeOption {
  value: DateRange;
  label: string;
}

const DATE_RANGE_OPTIONS: DateRangeOption[] = [
  { value: DateRange.LastWeek, label: 'Week' },
  { value: DateRange.LastMonth, label: 'Month' },
  { value: DateRange.LastQuarter, label: 'Quarter' },
  { value: DateRange.LastYear, label: 'Year' },
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
  styles.useVariants({ selected: isSelected });
  return (
    <AppPressable onPress={onPress} style={styles.chip}>
      <Text size="sm" weight="medium" style={styles.chipText}>
        {option.label}
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
