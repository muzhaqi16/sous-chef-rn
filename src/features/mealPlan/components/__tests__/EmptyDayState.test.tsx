'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { EmptyDayState } from '../EmptyDayState';

jest.mock('#components/atoms/Icon', () => ({
  Icon: ({
    name,
  }: React.ComponentProps<typeof import('#components/atoms/Icon').Icon>) => {
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
  it('says nothing is planned and points to the + to add a meal', () => {
    render(<EmptyDayState selectedDate={new Date('2026-03-02')} canAdd />);

    expect(screen.getByText('No meals planned')).toBeTruthy();
    expect(screen.getByText('Tap + to add a meal')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('gives no hint to add when the plan is read-only', () => {
    render(
      <EmptyDayState selectedDate={new Date('2026-03-02')} canAdd={false} />,
    );

    expect(screen.getByText('No meals planned')).toBeTruthy();
    expect(screen.queryByText('Tap + to add a meal')).toBeNull();
  });
});
