'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ProductResultCard } from '../ProductResultCard';
import { NetWeightKind } from '#/graphql/generated/schemaTypes';

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

  // Only a package figure is the pack's size; a serving shown bare would read
  // as one and be taken for the package.
  it('shows a package figure as the size', () => {
    render(
      <ProductResultCard
        item={{
          ...baseItem,
          netWeight: 500,
          netWeightKind: NetWeightKind.Package,
          displayUnit: { name: 'g' },
        }}
      />,
    );
    expect(screen.getByText('500 g')).toBeTruthy();
  });

  it('labels a serving figure as a serving', () => {
    render(
      <ProductResultCard
        item={{
          ...baseItem,
          netWeight: 30,
          netWeightKind: NetWeightKind.Serving,
          displayUnit: { name: 'g' },
        }}
      />,
    );
    expect(screen.getByText('One serving: 30 g')).toBeTruthy();
  });

  it('renders format when provided', () => {
    render(<ProductResultCard item={baseItem} format="UPC-A" />);
    expect(screen.getByText('Format: UPC-A')).toBeTruthy();
  });
});
