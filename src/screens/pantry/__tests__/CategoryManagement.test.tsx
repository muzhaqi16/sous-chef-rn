'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CategoryManagement } from '../CategoryManagement';

jest.mock('#/apollo/links/tokenScheduler', () => ({ scheduleTokenRefresh: jest.fn(), cancelScheduledRefresh: jest.fn() }));
jest.mock('#/apollo/links/refreshToken', () => ({ refreshAccessToken: jest.fn() }));
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));
jest.mock('#components/molecules/Header', () => ({
  Header: ({ title }: any) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));
jest.mock('#hooks/home/pantry/usePantryManagement', () => ({
  usePantryManagement: () => ({
    items: [
      { id: '1', item: { categories: [{ category: { name: 'Dairy' } }] } },
      { id: '2', item: { categories: [{ category: { name: 'Dairy' } }] } },
      { id: '3', item: { categories: [] } },
    ],
  }),
}));
jest.mock('#hooks/pantry/useCurrentPantry', () => ({
  useCurrentPantry: () => ({ pantry: { id: 'pantry-1' } }),
}));

describe('CategoryManagement', () => {
  it('renders with Categories title', () => {
    render(<CategoryManagement />);
    expect(screen.getByText('Categories')).toBeTruthy();
  });

  it('renders category names with item counts', () => {
    render(<CategoryManagement />);
    expect(screen.getByText('Dairy')).toBeTruthy();
    expect(screen.getByText('2 items')).toBeTruthy();
    expect(screen.getByText('Uncategorized')).toBeTruthy();
    expect(screen.getByText('1 items')).toBeTruthy();
  });
});
