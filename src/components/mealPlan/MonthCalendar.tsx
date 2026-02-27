import React from 'react';
import { Calendar, type DateData } from 'react-native-calendars';
import { useUnistyles } from 'react-native-unistyles';
import { format } from 'date-fns';

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
  const { theme } = useUnistyles();

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const minDateStr = minDate ? format(minDate, 'yyyy-MM-dd') : undefined;
  const maxDateStr = maxDate ? format(maxDate, 'yyyy-MM-dd') : undefined;

  const markedDates = (() => {
    const marks: Record<string, any> = {};

    // Mark days with meals
    if (daysWithMeals) {
      daysWithMeals.forEach(dateStr => {
        marks[dateStr] = {
          marked: true,
          dotColor: theme.colors.primary,
        };
      });
    }

    // Mark selected date
    marks[selectedDateStr] = {
      ...marks[selectedDateStr],
      selected: true,
      selectedColor: theme.colors.primary,
      selectedTextColor: theme.colors.white,
    };

    return marks;
  })();

  const handleDayPress = (day: DateData) => {
    onSelectDate(new Date(day.dateString + 'T12:00:00'));
  };

  return (
    <Calendar
      current={selectedDateStr}
      onDayPress={handleDayPress}
      markedDates={markedDates}
      markingType="dot"
      firstDay={1}
      enableSwipeMonths={false}
      minDate={minDateStr}
      maxDate={maxDateStr}
      theme={{
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
        textMonthFontWeight: 'bold',
        textDayFontSize: 14,
        textMonthFontSize: 16,
        textDayHeaderFontSize: 12,
      }}
    />
  );
};

MonthCalendar.displayName = 'MonthCalendar';
