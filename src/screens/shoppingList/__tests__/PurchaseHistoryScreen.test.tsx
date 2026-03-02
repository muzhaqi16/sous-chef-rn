'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PurchaseHistoryScreen } from '../PurchaseHistoryScreen';

jest.mock('#/apollo/links/tokenScheduler', () => ({ scheduleTokenRefresh: jest.fn(), cancelScheduledRefresh: jest.fn() }));
jest.mock('#/apollo/links/refreshToken', () => ({ refreshAccessToken: jest.fn() }));
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({ goBack: jest.fn() }),
}));
jest.mock('#components/atoms/BackButton', () => ({
  BackButton: ({ onPress }: any) => {
    const { Pressable, Text } = require('react-native');
    return <Pressable onPress={onPress}><Text>Back</Text></Pressable>;
  },
}));

describe('PurchaseHistoryScreen', () => {
  const purchases = [
    {
      id: 'p1',
      purchaseDate: '2026-01-15T10:00:00Z',
      quantity: 2,
      unitSymbol: 'kg',
      user: { id: 'u1', email: 'test@test.com', profile: { displayName: 'Alice' } },
    },
  ];

  it('renders header with item name', () => {
    render(
      <PurchaseHistoryScreen route={{ params: { itemId: '1', itemName: 'Milk', purchases } }} />,
    );
    expect(screen.getByText('Purchase History')).toBeTruthy();
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders purchase entries', () => {
    render(
      <PurchaseHistoryScreen route={{ params: { itemId: '1', itemName: 'Milk', purchases } }} />,
    );
    expect(screen.getByText('2 kg')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('renders empty state when no purchases', () => {
    render(
      <PurchaseHistoryScreen route={{ params: { itemId: '1', itemName: 'Milk', purchases: [] } }} />,
    );
    expect(screen.getByText('No purchase history')).toBeTruthy();
  });
});
