import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { format, isSameDay, isToday, isBefore, isAfter, startOfDay } from 'date-fns';
import { Icon } from '#utils/iconUtils';

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
  const isDayDisabled = (day: Date) => {
    const dayStart = startOfDay(day);
    if (minDate && isBefore(dayStart, startOfDay(minDate))) return true;
    if (maxDate && isAfter(dayStart, startOfDay(maxDate))) return true;
    return false;
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={canGoPrev ? onPrevWeek : undefined}
        style={[styles.arrowButton, !canGoPrev && styles.arrowButtonDisabled]}
        hitSlop={8}
      >
        <Icon
          name="chevron-back"
          size={20}
          color={canGoPrev ? styles.arrowIcon.color : styles.arrowIconDisabled.color}
        />
      </Pressable>

      <View style={styles.daysRow}>
        {weekDays.map(day => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentDay = isToday(day);
          const dateKey = format(day, 'yyyy-MM-dd');
          const hasMeals = daysWithMeals?.has(dateKey);
          const disabled = isDayDisabled(day);

          return (
            <Pressable
              key={dateKey}
              onPress={disabled ? undefined : () => onSelectDate(day)}
              style={[
                styles.dayItem,
                isSelected && styles.dayItemSelected,
                disabled && styles.dayItemDisabled,
              ]}
            >
              <Text
                style={[
                  styles.dayLabel,
                  isSelected && styles.dayLabelSelected,
                  isCurrentDay && !isSelected && styles.dayLabelToday,
                  disabled && styles.dayLabelDisabled,
                ]}
              >
                {format(day, 'EEE')}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  isSelected && styles.dayNumberSelected,
                  isCurrentDay && !isSelected && styles.dayNumberToday,
                  disabled && styles.dayNumberDisabled,
                ]}
              >
                {format(day, 'd')}
              </Text>
              {!!hasMeals && (
                <View
                  style={[
                    styles.mealDot,
                    isSelected && styles.mealDotSelected,
                  ]}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={canGoNext ? onNextWeek : undefined}
        style={[styles.arrowButton, !canGoNext && styles.arrowButtonDisabled]}
        hitSlop={8}
      >
        <Icon
          name="chevron-forward"
          size={20}
          color={canGoNext ? styles.arrowIcon.color : styles.arrowIconDisabled.color}
        />
      </Pressable>
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
  arrowIcon: {
    color: theme.colors.textSecondary,
  },
  arrowButtonDisabled: {
    opacity: 0.3,
  },
  arrowIconDisabled: {
    color: theme.colors.textTertiary,
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
    minWidth: 40,
  },
  dayItemSelected: {
    backgroundColor: theme.colors.primary,
  },
  dayItemDisabled: {
    opacity: 0.35,
  },
  dayLabel: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  dayLabelSelected: {
    color: theme.colors.white,
  },
  dayLabelToday: {
    color: theme.colors.primary,
  },
  dayLabelDisabled: {
    color: theme.colors.textTertiary,
  },
  dayNumber: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  dayNumberSelected: {
    color: theme.colors.white,
  },
  dayNumberToday: {
    color: theme.colors.primary,
  },
  dayNumberDisabled: {
    color: theme.colors.textTertiary,
  },
  mealDot: {
    width: 5,
    height: 5,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    marginTop: 3,
  },
  mealDotSelected: {
    backgroundColor: theme.colors.white,
  },
}));
