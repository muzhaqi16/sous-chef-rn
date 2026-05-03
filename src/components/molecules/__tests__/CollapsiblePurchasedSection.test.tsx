'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CollapsiblePurchasedSection } from '../CollapsiblePurchasedSection';

jest.mock('#utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#/constants/animations', () => ({
  SPRING: { EXPAND: {} },
  TIMING: { STANDARD: 200, FAST: 100 },
}));

jest.mock('#features/shoppingList/components/SortableShoppingList/SortableList', () => ({
  SortableShoppingList: ({ items }: any) => {
    const { View, Text } = require('react-native');
    const R = require('react');
    return R.createElement(
      View,
      { testID: 'sortable-list' },
      items.map((item: any) =>
        R.createElement(Text, { key: item.id }, item.name || item.id),
      ),
    );
  },
}));

const makeItem = (id: string, name = id) =>
  ({
    id,
    name,
    isPurchased: true,
  } as any);

describe('CollapsiblePurchasedSection', () => {
  const defaultProps = {
    purchasedItems: [makeItem('a', 'Milk'), makeItem('b', 'Bread')],
    unpurchasedCount: 3,
    onItemPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders null when purchasedItems is empty', () => {
    const { toJSON } = render(
      <CollapsiblePurchasedSection {...defaultProps} purchasedItems={[]} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders purchased count in header', () => {
    render(<CollapsiblePurchasedSection {...defaultProps} />);
    expect(screen.getByText('2 Purchased')).toBeTruthy();
  });

  it('toggles expansion on header press', () => {
    render(<CollapsiblePurchasedSection {...defaultProps} />);
    fireEvent.press(screen.getByText('2 Purchased'));
    // After pressing, the list should expand - check for sortable list
    expect(screen.getByTestId('sortable-list')).toBeTruthy();
  });

  it('shows Clear All button when onClearAll is provided', () => {
    render(
      <CollapsiblePurchasedSection {...defaultProps} onClearAll={jest.fn()} />,
    );
    expect(screen.getByText('Clear All')).toBeTruthy();
  });

  it('does not show Clear All when not provided', () => {
    render(<CollapsiblePurchasedSection {...defaultProps} />);
    expect(screen.queryByText('Clear All')).toBeNull();
  });

  it('auto-expands when unpurchasedCount is 0', () => {
    render(
      <CollapsiblePurchasedSection {...defaultProps} unpurchasedCount={0} />,
    );
    expect(screen.getByTestId('sortable-list')).toBeTruthy();
  });

  it('supports controlled expansion via isExpanded prop', () => {
    render(
      <CollapsiblePurchasedSection
        {...defaultProps}
        isExpanded={true}
        onExpandedChange={jest.fn()}
      />,
    );
    expect(screen.getByTestId('sortable-list')).toBeTruthy();
  });
});
