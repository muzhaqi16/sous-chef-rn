import { useState, useMemo, useCallback } from 'react';
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
} from 'date-fns';

export type CalendarView = 'week' | 'month';

export function useMealPlanCalendar() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarView>('week');
  const [referenceDate, setReferenceDate] = useState(new Date());

  // Week days for the current week view
  const weekDays = useMemo(() => {
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [referenceDate]);

  // Date range for filtering meal plan items
  const dateRange = useMemo(() => {
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
  }, [referenceDate, viewMode]);

  const goToNextWeek = useCallback(() => {
    setReferenceDate(prev => addWeeks(prev, 1));
  }, []);

  const goToPrevWeek = useCallback(() => {
    setReferenceDate(prev => subWeeks(prev, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setReferenceDate(prev => addMonths(prev, 1));
  }, []);

  const goToPrevMonth = useCallback(() => {
    setReferenceDate(prev => subMonths(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    setSelectedDate(today);
    setReferenceDate(today);
  }, []);

  const selectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setReferenceDate(date);
  }, []);

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
  };
}
