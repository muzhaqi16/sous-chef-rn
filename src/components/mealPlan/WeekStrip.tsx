import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { format, isSameDay, isToday } from 'date-fns';
import { Icon } from '#utils/iconUtils';

interface WeekStripProps {
  weekDays: Date[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  daysWithMeals?: Set<string>;
}

export const WeekStrip: React.FC<WeekStripProps> = ({
  weekDays,
  selectedDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  daysWithMeals,
}) => {
  return (
    <View style={styles.container}>
      <Pressable onPress={onPrevWeek} style={styles.arrowButton} hitSlop={8}>
        <Icon name="chevron-back" size={20} color={styles.arrowIcon.color} />
      </Pressable>

      <View style={styles.daysRow}>
        {weekDays.map(day => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentDay = isToday(day);
          const dateKey = format(day, 'yyyy-MM-dd');
          const hasMeals = daysWithMeals?.has(dateKey);

          return (
            <Pressable
              key={dateKey}
              onPress={() => onSelectDate(day)}
              style={[
                styles.dayItem,
                isSelected && styles.dayItemSelected,
              ]}
            >
              <Text
                style={[
                  styles.dayLabel,
                  isSelected && styles.dayLabelSelected,
                  isCurrentDay && !isSelected && styles.dayLabelToday,
                ]}
              >
                {format(day, 'EEE')}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  isSelected && styles.dayNumberSelected,
                  isCurrentDay && !isSelected && styles.dayNumberToday,
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

      <Pressable onPress={onNextWeek} style={styles.arrowButton} hitSlop={8}>
        <Icon name="chevron-forward" size={20} color={styles.arrowIcon.color} />
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
