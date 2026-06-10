'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ProductResultCard } from '../ProductResultCard';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: () => {
    const { View } = require('react-native');
    return <View testID="cached-image" />;
  },
}));

describe('ProductResultCard', () => {
  const baseItem = {
    id: '1',
    name: 'Organic Milk',
    upc: '123456789',
  };

  it('renders item name and barcode', () => {
    render(<ProductResultCard item={baseItem} />);
    expect(screen.getByText('Organic Milk')).toBeTruthy();
    expect(screen.getByText('Barcode: 123456789')).toBeTruthy();
  });

  it('renders brand name when provided', () => {
    render(<ProductResultCard item={{ ...baseItem, brandName: 'Horizon' }} />);
    expect(screen.getByText('Horizon')).toBeTruthy();
  });

  it('renders price when provided', () => {
    render(<ProductResultCard item={{ ...baseItem, price: 4.99 }} />);
    expect(screen.getByText('$4.99')).toBeTruthy();
  });

  it('renders format when provided', () => {
    render(<ProductResultCard item={baseItem} format="UPC-A" />);
    expect(screen.getByText('Format: UPC-A')).toBeTruthy();
  });
});
