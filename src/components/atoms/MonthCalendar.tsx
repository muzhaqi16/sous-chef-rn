import React from 'react';
import {
  Calendar,
  type DateData,
  type CalendarProps,
} from 'react-native-calendars';
import { withUnistyles } from 'react-native-unistyles';
import { fromDateKey, toDateKey } from '#/utils/dateUtils';

const ThemedCalendar = withUnistyles(Calendar, theme => ({
  theme: {
    backgroundColor: theme.colors.background,
    calendarBackground: theme.colors.background,
    textSectionTitleColor: theme.colors.textSecondary,
    selectedDayBackgroundColor: theme.colors.primary,
    selectedDayTextColor: theme.colors.onPrimary,
    todayTextColor: theme.colors.primary,
    dayTextColor: theme.colors.textPrimary,
    textDisabledColor: theme.colors.textTertiary,
    dotColor: theme.colors.primary,
    selectedDotColor: theme.colors.onPrimary,
    arrowColor: theme.colors.primary,
    monthTextColor: theme.colors.textPrimary,
    textMonthFontWeight: 'bold' as 'bold',
    textDayFontSize: 14,
    textMonthFontSize: 16,
    textDayHeaderFontSize: 12,
  },
}));

interface MonthCalendarProps {
  /** The day shown selected, and the month it opens on; today's when none. */
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  /** Days carrying a dot (YYYY-MM-DD), such as a meal plan's planned days. */
  markedDays?: ReadonlySet<string>;
  minDate?: Date;
  maxDate?: Date;
  testID?: string;
}

/** The app's one month calendar: the meal plan's, and every date field's. */
export const MonthCalendar: React.FC<MonthCalendarProps> = ({
  selectedDate,
  onSelectDate,
  markedDays,
  minDate,
  maxDate,
  testID,
}) => {
  const selectedKey = selectedDate ? toDateKey(selectedDate) : undefined;
  const minKey = minDate ? toDateKey(minDate) : undefined;
  const maxKey = maxDate ? toDateKey(maxDate) : undefined;

  const handleDayPress = (day: DateData) => {
    onSelectDate(fromDateKey(day.dateString));
  };

  return (
    <ThemedCalendar
      current={selectedKey}
      onDayPress={handleDayPress}
      uniProps={t => ({
        markedDates: (() => {
          const marks: NonNullable<CalendarProps['markedDates']> = {};
          markedDays?.forEach(key => {
            marks[key] = { marked: true, dotColor: t.colors.primary };
          });
          if (selectedKey) {
            marks[selectedKey] = {
              ...marks[selectedKey],
              selected: true,
              selectedColor: t.colors.primary,
              selectedTextColor: t.colors.onPrimary,
            };
          }
          return marks;
        })(),
      })}
      markingType="dot"
      firstDay={1}
      enableSwipeMonths={false}
      minDate={minKey}
      maxDate={maxKey}
      testID={testID}
    />
  );
};

MonthCalendar.displayName = 'MonthCalendar';
