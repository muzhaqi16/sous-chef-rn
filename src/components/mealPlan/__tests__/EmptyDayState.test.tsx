'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EmptyDayState } from '../EmptyDayState';

jest.mock('#/apollo/links/tokenScheduler', () => ({ scheduleTokenRefresh: jest.fn(), cancelScheduledRefresh: jest.fn() }));
jest.mock('#/apollo/links/refreshToken', () => ({ refreshAccessToken: jest.fn() }));
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));
jest.mock('date-fns', () => ({
  format: () => 'Monday, March 2',
}));
jest.mock('#constants/layout', () => ({
  getTabBarBottomPadding: (bottom: number) => bottom + 10,
}));

describe('EmptyDayState', () => {
  it('renders no meals planned message', () => {
    render(<EmptyDayState selectedDate={new Date('2026-03-02')} />);
    expect(screen.getByText('No meals planned')).toBeTruthy();
  });

  it('renders add meal button when onAddMeal provided', () => {
    const onAddMeal = jest.fn();
    render(<EmptyDayState selectedDate={new Date('2026-03-02')} onAddMeal={onAddMeal} />);
    expect(screen.getByText('Add a meal')).toBeTruthy();
  });

  it('calls onAddMeal when button pressed', () => {
    const onAddMeal = jest.fn();
    render(<EmptyDayState selectedDate={new Date('2026-03-02')} onAddMeal={onAddMeal} />);
    fireEvent.press(screen.getByText('Add a meal'));
    expect(onAddMeal).toHaveBeenCalled();
  });

  it('does not show add button when onAddMeal is not provided', () => {
    render(<EmptyDayState selectedDate={new Date('2026-03-02')} />);
    expect(screen.queryByText('Add a meal')).toBeNull();
  });
});
