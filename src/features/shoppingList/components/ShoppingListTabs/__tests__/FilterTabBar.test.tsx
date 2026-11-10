'use no memo';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FilterTabBar } from '../FilterTabBar';

jest.mock('#components/atoms/Icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));

describe('FilterTabBar', () => {
  const navigationState = {
    index: 0,
    routes: [
      { key: 'all', title: 'All' },
      { key: 'pending', title: 'Pending' },
      { key: 'done', title: 'Done' },
    ],
  };
  const jumpTo = jest.fn();

  it('renders all tab titles', () => {
    render(<FilterTabBar navigationState={navigationState} jumpTo={jumpTo} />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('renders each mode as a tab with its count', () => {
    render(
      <FilterTabBar
        navigationState={navigationState}
        jumpTo={jumpTo}
        counts={{ all: 10, pending: 5, done: 3 }}
      />,
    );
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByTestId('filter-tab-all').props.accessibilityRole).toBe(
      'tab',
    );
    expect(
      screen.getByTestId('filter-tab-all').props.accessibilityState,
    ).toMatchObject({ selected: true });
  });

  it('switches mode from a tab', () => {
    render(<FilterTabBar navigationState={navigationState} jumpTo={jumpTo} />);
    fireEvent.press(screen.getByTestId('filter-tab-done'));
    expect(jumpTo).toHaveBeenCalledWith('done');
  });

  it('renders action buttons when provided', () => {
    const actionButtons = [
      {
        icon: 'filter',
        accessibilityLabel: 'Filter',
        onPress: jest.fn(),
        testID: 'filter-btn',
      },
    ];
    render(
      <FilterTabBar
        navigationState={navigationState}
        jumpTo={jumpTo}
        actionButtons={actionButtons}
      />,
    );
    expect(screen.getByText('filter')).toBeTruthy();
  });
});
