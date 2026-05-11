import React from 'react';
import { Calendar, type DateData } from 'react-native-calendars';
import { withUnistyles } from 'react-native-unistyles';
import { format } from 'date-fns';

const ThemedCalendar = withUnistyles(Calendar, theme => ({
  theme: {
    backgroundColor: theme.colors.background,
    calendarBackground: theme.colors.background,
    textSectionTitleColor: theme.colors.textSecondary,
    selectedDayBackgroundColor: theme.colors.primary,
    selectedDayTextColor: theme.colors.white,
    todayTextColor: theme.colors.primary,
    dayTextColor: theme.colors.textPrimary,
    textDisabledColor: theme.colors.textTertiary,
    dotColor: theme.colors.primary,
    selectedDotColor: theme.colors.white,
    arrowColor: theme.colors.primary,
    monthTextColor: theme.colors.textPrimary,
    textMonthFontWeight: 'bold' as 'bold',
    textDayFontSize: 14,
    textMonthFontSize: 16,
    textDayHeaderFontSize: 12,
  },
}));

interface MonthCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  daysWithMeals?: Set<string>;
  minDate?: Date;
  maxDate?: Date;
}

export const MonthCalendar: React.FC<MonthCalendarProps> = ({
  selectedDate,
  onSelectDate,
  daysWithMeals,
  minDate,
  maxDate,
}) => {
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const minDateStr = minDate ? format(minDate, 'yyyy-MM-dd') : undefined;
  const maxDateStr = maxDate ? format(maxDate, 'yyyy-MM-dd') : undefined;

  const handleDayPress = (day: DateData) => {
    onSelectDate(new Date(day.dateString + 'T12:00:00'));
  };

  return (
    <ThemedCalendar
      current={selectedDateStr}
      onDayPress={handleDayPress}
      uniProps={t => ({
        markedDates: (() => {
          const marks: Record<string, any> = {};
          if (daysWithMeals) {
            daysWithMeals.forEach(dateStr => {
              marks[dateStr] = { marked: true, dotColor: t.colors.primary };
            });
          }
          marks[selectedDateStr] = {
            ...marks[selectedDateStr],
            selected: true,
            selectedColor: t.colors.primary,
            selectedTextColor: t.colors.white,
          };
          return marks;
        })(),
      })}
      markingType="dot"
      firstDay={1}
      enableSwipeMonths={false}
      minDate={minDateStr}
      maxDate={maxDateStr}
    />
  );
};

MonthCalendar.displayName = 'MonthCalendar';
