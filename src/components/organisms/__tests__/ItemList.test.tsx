import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { ItemCard as ItemCardComponent } from '../ItemCard';
import type { EmptyStateProps } from '../../base/EmptyState';
import { ItemList } from '../ItemList';

type ItemCardProps = React.ComponentProps<typeof ItemCardComponent>;

jest.mock('#hooks/performance/useFlashListPerformance', () => ({
  useFlashListPerformance: () => ({
    onLoad: jest.fn(),
    onViewableItemsChanged: jest.fn(),
    onDataReferenceChange: jest.fn(),
    printReport: jest.fn(),
    getBlankRisk: () => ({
      level: 'none',
      factors: [],
      coverageRatio: 1,
      scrollVelocity: 0,
    }),
  }),
}));
jest.mock('#hooks/performance/useDataReferenceTracker', () => ({
  useDataReferenceTracker: jest.fn(),
}));
jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: () => null,
  preloadImages: jest.fn(),
}));

jest.mock('../ItemCard', () => {
  const { Text, View } = require('react-native');
  return {
    ItemCard: ({
      title,
      subtitle,
      testID,
    }: Pick<ItemCardProps, 'title' | 'subtitle' | 'testID'>) => (
      <View testID={testID}>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
      </View>
    ),
  };
});

jest.mock('../../base/EmptyState', () => {
  const { Text } = require('react-native');
  return {
    EmptyState: ({
      title,
      description,
    }: Pick<EmptyStateProps, 'title' | 'description'>) => (
      <>
        <Text>{title}</Text>
        {description ? <Text>{description}</Text> : null}
      </>
    ),
  };
});

describe('ItemList', () => {
  const items = [
    { id: '1', title: 'Milk', subtitle: '2 gallons' },
    { id: '2', title: 'Eggs', subtitle: '12 count' },
    { id: '3', title: 'Bread', subtitle: '1 loaf' },
  ];

  const defaultProps = {
    items,
    onItemPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders list items', () => {
    render(<ItemList {...defaultProps} />);
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('Eggs')).toBeTruthy();
    expect(screen.getByText('Bread')).toBeTruthy();
  });

  it('renders empty state when items is empty and emptyState provided', () => {
    render(
      <ItemList
        items={[]}
        onItemPress={jest.fn()}
        emptyState={{
          icon: 'cube-outline',
          title: 'No items',
          description: 'Add some items to get started',
        }}
      />,
    );
    expect(screen.getByText('No items')).toBeTruthy();
    expect(screen.getByText('Add some items to get started')).toBeTruthy();
  });

  it('renders items with testID prefix', () => {
    render(<ItemList {...defaultProps} testIDPrefix="pantry" />);
    expect(screen.getByTestId('pantry-0')).toBeTruthy();
    expect(screen.getByTestId('pantry-1')).toBeTruthy();
    expect(screen.getByTestId('pantry-2')).toBeTruthy();
  });

  it('renders ListHeaderComponent as element', () => {
    const { Text } = require('react-native');
    render(
      <ItemList
        {...defaultProps}
        ListHeaderComponent={<Text>Header Content</Text>}
      />,
    );
    expect(screen.getByText('Header Content')).toBeTruthy();
  });

  it('renders ListHeaderComponent with empty state', () => {
    const { Text } = require('react-native');
    render(
      <ItemList
        items={[]}
        onItemPress={jest.fn()}
        ListHeaderComponent={<Text>Search Bar</Text>}
        emptyState={{
          icon: 'cube-outline',
          title: 'Empty',
        }}
      />,
    );
    expect(screen.getByText('Search Bar')).toBeTruthy();
    expect(screen.getByText('Empty')).toBeTruthy();
  });

  it('does not render empty state when items exist', () => {
    render(
      <ItemList
        {...defaultProps}
        emptyState={{
          icon: 'cube-outline',
          title: 'No items',
        }}
      />,
    );
    expect(screen.queryByText('No items')).toBeNull();
    expect(screen.getByText('Milk')).toBeTruthy();
  });
});
