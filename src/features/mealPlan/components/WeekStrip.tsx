import React from 'react';
import { IconButton } from '#components/atoms/IconButton';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { isSameDay, isToday, isBefore, isAfter, startOfDay } from 'date-fns';
import { Text } from '#components/atoms/Text';
import { formatDayOfMonth, formatWeekdayShort } from '#utils/formatters/date';
import { toDateKey } from '#utils/dateUtils';
import { useTranslation } from '#i18n';

interface WeekStripProps {
  weekDays: Date[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  daysWithMeals?: Set<string>;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

export const WeekStrip: React.FC<WeekStripProps> = ({
  weekDays,
  selectedDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  daysWithMeals,
  canGoPrev = true,
  canGoNext = true,
  minDate,
  maxDate,
}) => {
  const { t } = useTranslation();
  const isDayDisabled = (day: Date) => {
    const dayStart = startOfDay(day);
    if (minDate && isBefore(dayStart, startOfDay(minDate))) return true;
    if (maxDate && isAfter(dayStart, startOfDay(maxDate))) return true;
    return false;
  };

  return (
    <View style={styles.container}>
      <IconButton
        name="chevron-back"
        size="sm"
        tone="textSecondary"
        onPress={onPrevWeek}
        disabled={!canGoPrev}
        accessibilityLabel={t('a11y.previousWeek')}
        style={styles.arrowButton}
      />

      <View style={styles.daysRow}>
        {weekDays.map(day => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentDay = isToday(day);
          const dateKey = toDateKey(day);
          const hasMeals = daysWithMeals?.has(dateKey);
          const disabled = isDayDisabled(day);

          return (
            <AppPressable
              key={dateKey}
              onPress={disabled ? undefined : () => onSelectDate(day)}
              style={[
                styles.dayItem,
                isSelected && styles.dayItemSelected,
                disabled && styles.dayItemDisabled,
              ]}
            >
              <Text
                role="label"
                style={[
                  styles.dayLabel,
                  isSelected && styles.dayLabelSelected,
                  isCurrentDay && !isSelected && styles.dayLabelToday,
                  disabled && styles.dayLabelDisabled,
                ]}
              >
                {formatWeekdayShort(day)}
              </Text>
              <Text
                role="bodyStrong"
                style={[
                  styles.dayNumber,
                  isSelected && styles.dayNumberSelected,
                  isCurrentDay && !isSelected && styles.dayNumberToday,
                  disabled && styles.dayNumberDisabled,
                ]}
              >
                {formatDayOfMonth(day)}
              </Text>
              {!!hasMeals && (
                <View
                  style={[styles.mealDot, isSelected && styles.mealDotSelected]}
                />
              )}
            </AppPressable>
          );
        })}
      </View>

      <IconButton
        name="chevron-forward"
        size="sm"
        tone="textSecondary"
        onPress={onNextWeek}
        disabled={!canGoNext}
        accessibilityLabel={t('a11y.nextWeek')}
        style={styles.arrowButton}
      />
    </View>
  );
};

WeekStrip.displayName = 'WeekStrip';

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  arrowButton: {
    padding: theme.spacing.xs,
  },
  daysRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayItem: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    minWidth: 40,
  },
  dayItemSelected: {
    backgroundColor: theme.colors.primary,
  },
  dayItemDisabled: {
    opacity: 0.35,
  },
  dayLabel: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing['2xs'],
  },
  dayLabelSelected: {
    color: theme.colors.onPrimary,
  },
  dayLabelToday: {
    color: theme.colors.primaryText,
  },
  dayLabelDisabled: {
    color: theme.colors.textTertiary,
  },
  dayNumber: {
    color: theme.colors.textPrimary,
  },
  dayNumberSelected: {
    color: theme.colors.onPrimary,
  },
  dayNumberToday: {
    color: theme.colors.primaryText,
  },
  dayNumberDisabled: {
    color: theme.colors.textTertiary,
  },
  mealDot: {
    width: 5,
    height: 5,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    marginTop: theme.spacing['2xsPlus'],
  },
  mealDotSelected: {
    backgroundColor: theme.colors.surface,
  },
}));
