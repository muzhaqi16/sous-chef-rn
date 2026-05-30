'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { FilterTabBar } from '../FilterTabBar';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));
jest.mock('../FilterTabItem', () => ({
  FilterTabItem: ({ title, testID }: { title: string; testID?: string }) => {
    const { Text } = require('react-native');
    return <Text testID={testID}>{title}</Text>;
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

  it('renders with counts', () => {
    render(
      <FilterTabBar
        navigationState={navigationState}
        jumpTo={jumpTo}
        counts={{ all: 10, pending: 5, done: 5 }}
      />,
    );
    expect(screen.getByTestId('filter-tab-all')).toBeTruthy();
  });

  it('renders action buttons when provided', () => {
    const actionButtons = [
      { icon: 'filter', onPress: jest.fn(), testID: 'filter-btn' },
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
