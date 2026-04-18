import { useState } from 'react';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  eachDayOfInterval,
  format,
  isSameDay,
  isBefore,
  isAfter,
  startOfDay,
} from 'date-fns';

export type CalendarView = 'week' | 'month';

interface UseMealPlanCalendarOptions {
  minDate?: Date;
  maxDate?: Date;
}

const clampToRange = (date: Date, min?: Date, max?: Date): Date => {
  if (min && isBefore(startOfDay(date), startOfDay(min))) return min;
  if (max && isAfter(startOfDay(date), startOfDay(max))) return max;
  return date;
};

export function useMealPlanCalendar(options?: UseMealPlanCalendarOptions) {
  const { minDate, maxDate } = options ?? {};

  const initialDate = clampToRange(new Date(), minDate, maxDate);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [viewMode, setViewMode] = useState<CalendarView>('week');
  const [referenceDate, setReferenceDate] = useState(initialDate);

  // Clamp selected/reference dates when boundaries change (plan loads)
  const minTime = minDate?.getTime();
  const maxTime = maxDate?.getTime();

  // Render-time conditional state update: track boundary changes
  const [prevMinTime, setPrevMinTime] = useState(minTime);
  const [prevMaxTime, setPrevMaxTime] = useState(maxTime);

  if (minTime !== prevMinTime || maxTime !== prevMaxTime) {
    setPrevMinTime(minTime);
    setPrevMaxTime(maxTime);

    if (minDate || maxDate) {
      const clampedDate = clampToRange(new Date(), minDate, maxDate);
      setSelectedDate(clampedDate);
      setReferenceDate(clampedDate);
    }
  }

  // Week days for the current week view
  const weekDays = (() => {
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  })();

  // Date range for filtering meal plan items
  const dateRange = (() => {
    if (viewMode === 'week') {
      return {
        startDate: startOfWeek(referenceDate, { weekStartsOn: 1 }),
        endDate: endOfWeek(referenceDate, { weekStartsOn: 1 }),
      };
    }
    return {
      startDate: startOfMonth(referenceDate),
      endDate: endOfMonth(referenceDate),
    };
  })();

  // Compute navigation boundary flags
  const canGoPrevWeek = (() => {
    if (!minDate) return true;
    const prevWeekEnd = endOfWeek(subWeeks(referenceDate, 1), {
      weekStartsOn: 1,
    });
    return !isBefore(startOfDay(prevWeekEnd), startOfDay(minDate));
  })();

  const canGoNextWeek = (() => {
    if (!maxDate) return true;
    const nextWeekStart = startOfWeek(addWeeks(referenceDate, 1), {
      weekStartsOn: 1,
    });
    return !isAfter(startOfDay(nextWeekStart), startOfDay(maxDate));
  })();

  const goToNextWeek = () => {
    if (!canGoNextWeek) return;
    setReferenceDate(prev => addWeeks(prev, 1));
  };

  const goToPrevWeek = () => {
    if (!canGoPrevWeek) return;
    setReferenceDate(prev => subWeeks(prev, 1));
  };

  const goToNextMonth = () => {
    setReferenceDate(prev => addMonths(prev, 1));
  };

  const goToPrevMonth = () => {
    setReferenceDate(prev => subMonths(prev, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setReferenceDate(today);
  };

  const selectDate = (date: Date) => {
    if (minDate && isBefore(startOfDay(date), startOfDay(minDate))) return;
    if (maxDate && isAfter(startOfDay(date), startOfDay(maxDate))) return;
    setSelectedDate(date);
    setReferenceDate(date);
  };

  const formattedMonth = format(referenceDate, 'MMMM yyyy');
  const isToday = isSameDay(selectedDate, new Date());

  return {
    selectedDate,
    referenceDate,
    viewMode,
    setViewMode,
    weekDays,
    dateRange,
    formattedMonth,
    isToday,
    goToNextWeek,
    goToPrevWeek,
    goToNextMonth,
    goToPrevMonth,
    goToToday,
    selectDate,
    canGoPrevWeek,
    canGoNextWeek,
    minDate,
    maxDate,
  };
}
