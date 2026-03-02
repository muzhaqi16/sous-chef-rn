'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { PantryFilterChips } from '../../../src/components/pantry/PantryFilterChips';

jest.mock('../../../src/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../src/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

jest.mock('../../../src/components/atoms/Chip', () => {
  const { Text, Pressable } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => (
      <Pressable onPress={props.onPress}>
        <Text>{props.label}</Text>
      </Pressable>
    ),
  };
});

describe('PantryFilterChips', () => {
  const defaultProps = {
    activeFilters: new Set<any>(),
    onFilterChange: jest.fn(),
    stats: { expired: 0, expiringSoon: 0, lowStock: 0 },
  };

  it('returns null when no filters have items', () => {
    const { toJSON } = render(<PantryFilterChips {...defaultProps} />);
    expect(toJSON()).toBeNull();
  });

  it('renders expiring filter when items exist', () => {
    const { getByText } = render(
      <PantryFilterChips
        {...defaultProps}
        stats={{ expired: 0, expiringSoon: 3, lowStock: 0 }}
      />,
    );
    expect(getByText('Expiring (3)')).toBeTruthy();
  });

  it('renders multiple filters when items exist', () => {
    const { getByText } = render(
      <PantryFilterChips
        {...defaultProps}
        stats={{ expired: 2, expiringSoon: 3, lowStock: 1 }}
      />,
    );
    expect(getByText('Expiring (3)')).toBeTruthy();
    expect(getByText('Expired (2)')).toBeTruthy();
    expect(getByText('Low Stock (1)')).toBeTruthy();
  });

  it('renders storage filters when counts provided', () => {
    const { getByText } = render(
      <PantryFilterChips
        {...defaultProps}
        storageCounts={{ refrigerated: 5, frozen: 2 }}
      />,
    );
    expect(getByText('Refrigerated (5)')).toBeTruthy();
    expect(getByText('Frozen (2)')).toBeTruthy();
  });
});
