import { renderHook, act } from '@testing-library/react-native';
import { useMealPlanCalendar } from '../useMealPlanCalendar';
import { startOfWeek, endOfWeek, isSameDay, format, addWeeks, subWeeks } from 'date-fns';

// No external mocks needed — this hook is pure date logic

describe('useMealPlanCalendar', () => {
  it('initializes with today as selected date', () => {
    const { result } = renderHook(() => useMealPlanCalendar());

    expect(isSameDay(result.current.selectedDate, new Date())).toBe(true);
  });

  it('defaults to week view', () => {
    const { result } = renderHook(() => useMealPlanCalendar());

    expect(result.current.viewMode).toBe('week');
  });

  it('returns 7 weekDays starting from Monday', () => {
    const { result } = renderHook(() => useMealPlanCalendar());

    expect(result.current.weekDays).toHaveLength(7);
    // First day should be Monday (day of week = 1)
    expect(result.current.weekDays[0].getDay()).toBe(1);
    // Last day should be Sunday (day of week = 0)
    expect(result.current.weekDays[6].getDay()).toBe(0);
  });

  it('dateRange matches current week in week view', () => {
    const { result } = renderHook(() => useMealPlanCalendar());

    const today = new Date();
    const expectedStart = startOfWeek(today, { weekStartsOn: 1 });
    const expectedEnd = endOfWeek(today, { weekStartsOn: 1 });

    expect(isSameDay(result.current.dateRange.startDate, expectedStart)).toBe(true);
    expect(isSameDay(result.current.dateRange.endDate, expectedEnd)).toBe(true);
  });

  it('goToNextWeek advances referenceDate by one week', () => {
    const { result } = renderHook(() => useMealPlanCalendar());

    const initialRef = result.current.referenceDate;

    act(() => {
      result.current.goToNextWeek();
    });

    const expected = addWeeks(initialRef, 1);
    expect(isSameDay(result.current.referenceDate, expected)).toBe(true);
  });

  it('goToPrevWeek moves referenceDate back by one week', () => {
    const { result } = renderHook(() => useMealPlanCalendar());

    const initialRef = result.current.referenceDate;

    act(() => {
      result.current.goToPrevWeek();
    });

    const expected = subWeeks(initialRef, 1);
    expect(isSameDay(result.current.referenceDate, expected)).toBe(true);
  });

  it('selectDate changes both selectedDate and referenceDate', () => {
    const { result } = renderHook(() => useMealPlanCalendar());

    const targetDate = new Date(2025, 5, 15); // June 15, 2025

    act(() => {
      result.current.selectDate(targetDate);
    });

    expect(isSameDay(result.current.selectedDate, targetDate)).toBe(true);
    expect(isSameDay(result.current.referenceDate, targetDate)).toBe(true);
  });

  it('goToToday resets to today', () => {
    const { result } = renderHook(() => useMealPlanCalendar());

    // Move away from today first
    act(() => {
      result.current.selectDate(new Date(2025, 0, 1));
    });

    act(() => {
      result.current.goToToday();
    });

    expect(isSameDay(result.current.selectedDate, new Date())).toBe(true);
  });

  it('formattedMonth matches current reference date', () => {
    const { result } = renderHook(() => useMealPlanCalendar());

    const expected = format(result.current.referenceDate, 'MMMM yyyy');
    expect(result.current.formattedMonth).toBe(expected);
  });

  it('isToday is true when selected date is today', () => {
    const { result } = renderHook(() => useMealPlanCalendar());

    expect(result.current.isToday).toBe(true);
  });

  it('isToday is false when selected date is not today', () => {
    const { result } = renderHook(() => useMealPlanCalendar());

    act(() => {
      result.current.selectDate(new Date(2025, 0, 1));
    });

    expect(result.current.isToday).toBe(false);
  });

  describe('with boundaries', () => {
    it('clamps initial date to minDate', () => {
      const futureDate = new Date(2030, 0, 1);
      const { result } = renderHook(() =>
        useMealPlanCalendar({ minDate: futureDate }),
      );

      expect(isSameDay(result.current.selectedDate, futureDate)).toBe(true);
    });

    it('selectDate refuses dates before minDate', () => {
      const minDate = new Date(2025, 5, 1);
      const { result } = renderHook(() =>
        useMealPlanCalendar({ minDate }),
      );

      const beforeMin = new Date(2025, 4, 1);
      act(() => {
        result.current.selectDate(beforeMin);
      });

      // Should not have changed to beforeMin
      expect(isSameDay(result.current.selectedDate, beforeMin)).toBe(false);
    });

    it('selectDate refuses dates after maxDate', () => {
      const maxDate = new Date(2025, 5, 30);
      const { result } = renderHook(() =>
        useMealPlanCalendar({ maxDate }),
      );

      const afterMax = new Date(2026, 0, 1);
      act(() => {
        result.current.selectDate(afterMax);
      });

      expect(isSameDay(result.current.selectedDate, afterMax)).toBe(false);
    });

    it('goToPrevWeek is blocked when at minDate boundary', () => {
      // Set minDate to today so previous week end falls before minDate
      const today = new Date();
      const { result } = renderHook(() =>
        useMealPlanCalendar({ minDate: today }),
      );

      // Previous week's end is before today, so we cannot go back
      expect(result.current.canGoPrevWeek).toBe(false);

      // goToPrevWeek should have no effect
      const refBefore = result.current.referenceDate;
      act(() => {
        result.current.goToPrevWeek();
      });
      expect(isSameDay(result.current.referenceDate, refBefore)).toBe(true);
    });
  });

  it('setViewMode switches between week and month', () => {
    const { result } = renderHook(() => useMealPlanCalendar());

    act(() => {
      result.current.setViewMode('month');
    });

    expect(result.current.viewMode).toBe('month');
  });
});
