'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PurchaseHistoryScreen } from '../PurchaseHistoryScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));
jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#components/atoms/BackButton', () => ({
  BackButton: ({ onPress }: { onPress: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onPress}>
        <Text>Back</Text>
      </Pressable>
    );
  },
}));

describe('PurchaseHistoryScreen', () => {
  const purchases = [
    {
      id: 'p1',
      purchaseDate: '2026-01-15T10:00:00Z',
      quantity: 2,
      unitPrice: 2.5,
      totalPrice: 5,
      currencySymbol: '$',
      unitSymbol: 'kg',
      user: {
        id: 'u1',
        email: 'test@test.com',
        profile: { displayName: 'Alice' },
      },
    },
  ];

  it('renders header with item name', () => {
    render(
      <PurchaseHistoryScreen
        route={{ params: { itemId: '1', itemName: 'Milk', purchases } }}
      />,
    );
    expect(screen.getByText('Purchase History')).toBeTruthy();
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders purchase entries', () => {
    render(
      <PurchaseHistoryScreen
        route={{ params: { itemId: '1', itemName: 'Milk', purchases } }}
      />,
    );
    expect(screen.getByText('2 kg')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('renders the per-purchase price and spending summary', () => {
    render(
      <PurchaseHistoryScreen
        route={{ params: { itemId: '1', itemName: 'Milk', purchases } }}
      />,
    );
    // Per-row total price and the header total/average (one priced purchase, so
    // total and average are both $5.00).
    expect(screen.getAllByText('$5.00').length).toBeGreaterThan(0);
  });

  it('omits price when a purchase has no recorded amount', () => {
    const unpriced = [
      {
        id: 'p2',
        purchaseDate: '2026-02-01T10:00:00Z',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        currencySymbol: '$',
        unitSymbol: 'kg',
      },
    ];
    render(
      <PurchaseHistoryScreen
        route={{
          params: { itemId: '1', itemName: 'Milk', purchases: unpriced },
        }}
      />,
    );
    expect(screen.queryByText('Price:')).toBeNull();
  });

  it('renders empty state when no purchases', () => {
    render(
      <PurchaseHistoryScreen
        route={{ params: { itemId: '1', itemName: 'Milk', purchases: [] } }}
      />,
    );
    expect(screen.getByText('No purchase history')).toBeTruthy();
  });
});
