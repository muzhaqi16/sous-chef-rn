import React from 'react';
import { useTranslation, type TranslationKey } from '#i18n';
import { ChipScrollRow } from '#components/molecules/ChipScrollRow';
import { StyleSheet } from 'react-native-unistyles';
import { DateRange } from '#graphql/generated/schemaTypes';

interface DateRangeOption {
  value: DateRange;
  /** i18n key path — the options array is module-level, so no hook. */
  labelKey: TranslationKey;
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

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  selected,
  onSelect,
}) => {
  const { t } = useTranslation();
  return (
    <ChipScrollRow
      options={DATE_RANGE_OPTIONS.map(option => ({
        key: option.value,
        label: t(option.labelKey),
      }))}
      selected={selected}
      onSelect={onSelect}
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    />
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
}));
