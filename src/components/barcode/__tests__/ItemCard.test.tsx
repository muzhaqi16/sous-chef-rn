'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ItemCard } from '../ItemCard';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: () => {
    const { View } = require('react-native');
    return <View testID="cached-image" />;
  },
}));

describe('ItemCard', () => {
  const baseItem = {
    id: '1',
    name: 'Organic Milk',
    upc: '123456789',
  };

  it('renders item name and barcode', () => {
    render(<ItemCard item={baseItem} />);
    expect(screen.getByText('Organic Milk')).toBeTruthy();
    expect(screen.getByText('Barcode: 123456789')).toBeTruthy();
  });

  it('renders brand name when provided', () => {
    render(<ItemCard item={{ ...baseItem, brandName: 'Horizon' }} />);
    expect(screen.getByText('Horizon')).toBeTruthy();
  });

  it('renders price when provided', () => {
    render(<ItemCard item={{ ...baseItem, price: 4.99 }} />);
    expect(screen.getByText('$4.99')).toBeTruthy();
  });

  it('renders format when provided', () => {
    render(<ItemCard item={baseItem} format="UPC-A" />);
    expect(screen.getByText('Format: UPC-A')).toBeTruthy();
  });
});
