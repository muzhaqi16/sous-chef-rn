'use no memo';

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { WeekStrip } from '../../../src/components/mealPlan/WeekStrip';

jest.mock('../../../src/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../src/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

describe('WeekStrip', () => {
  const baseDate = new Date('2025-03-10'); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  const defaultProps = {
    weekDays,
    selectedDate: baseDate,
    onSelectDate: jest.fn(),
    onPrevWeek: jest.fn(),
    onNextWeek: jest.fn(),
  };

  it('renders without crashing', () => {
    const { toJSON } = render(<WeekStrip {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders 7 day numbers', () => {
    const { getByText } = render(<WeekStrip {...defaultProps} />);
    expect(getByText('10')).toBeTruthy();
    expect(getByText('11')).toBeTruthy();
    expect(getByText('12')).toBeTruthy();
  });

  it('renders day labels', () => {
    const { getByText } = render(<WeekStrip {...defaultProps} />);
    expect(getByText('Mon')).toBeTruthy();
    expect(getByText('Tue')).toBeTruthy();
  });

  it('calls onSelectDate when a day is pressed', () => {
    const onSelectDate = jest.fn();
    const { getByText } = render(
      <WeekStrip {...defaultProps} onSelectDate={onSelectDate} />,
    );
    fireEvent.press(getByText('12'));
    expect(onSelectDate).toHaveBeenCalled();
  });

  it('renders meal dots when daysWithMeals provided', () => {
    const { toJSON } = render(
      <WeekStrip
        {...defaultProps}
        daysWithMeals={new Set(['2025-03-10'])}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
