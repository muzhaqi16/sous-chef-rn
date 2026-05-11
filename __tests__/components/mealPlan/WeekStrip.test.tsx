'use no memo';

import React from 'react';
import { render, userEvent } from '@testing-library/react-native';
import { WeekStrip } from '../../../src/features/mealPlan/components/WeekStrip';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

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

  it('calls onSelectDate when a day is pressed', async () => {
    const user = userEvent.setup();
    const onSelectDate = jest.fn();
    const { getByText } = render(
      <WeekStrip {...defaultProps} onSelectDate={onSelectDate} />,
    );
    await user.press(getByText('12'));
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
