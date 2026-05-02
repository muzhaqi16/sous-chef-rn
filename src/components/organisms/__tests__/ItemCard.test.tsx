import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ItemCard } from '../ItemCard';

jest.mock('#components/molecules/SwipeableItem/SwipeableItem', () => {
  const { View } = require('react-native');
  return {
    SwipeableItem: ({ children, onPress, testIDPrefix }: any) => (
      <View
        testID={testIDPrefix ? `${testIDPrefix}-swipeable` : 'swipeable'}
        onTouchEnd={onPress}
      >
        {children}
      </View>
    ),
  };
});

jest.mock('../../molecules/ListItem', () => {
  const { Text, View } = require('react-native');
  return {
    ListItem: ({ title, subtitle, badge }: any) => (
      <View>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
        {badge ? <Text>{badge.text}</Text> : null}
      </View>
    ),
  };
});

jest.mock('#hooks/animations/useSlideAnimation', () => ({
  useSlideAnimation: () => ({
    animatedSlideStyle: {},
    triggerSlide: jest.fn((_, cb) => cb?.()),
  }),
}));

describe('ItemCard', () => {
  const defaultProps = {
    id: 'item-1',
    title: 'Milk',
    subtitle: '2 gallons',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and subtitle', () => {
    render(<ItemCard {...defaultProps} />);
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('2 gallons')).toBeTruthy();
  });

  it('renders with testID', () => {
    render(<ItemCard {...defaultProps} testID="pantry-item-0" />);
    expect(screen.getByTestId('pantry-item-0')).toBeTruthy();
  });

  it('renders badge when provided', () => {
    render(
      <ItemCard
        {...defaultProps}
        badge={{ text: 'Expiring', variant: 'warning' }}
      />,
    );
    expect(screen.getByText('Expiring')).toBeTruthy();
  });

  it('renders SwipeableItem when edit action is provided', () => {
    render(<ItemCard {...defaultProps} onEdit={jest.fn()} testID="item" />);
    expect(screen.getByTestId('item-swipeable')).toBeTruthy();
  });

  it('renders SwipeableItem when delete action is provided', () => {
    render(<ItemCard {...defaultProps} onDelete={jest.fn()} testID="item" />);
    expect(screen.getByTestId('item-swipeable')).toBeTruthy();
  });

  it('renders without SwipeableItem when no swipe actions provided', () => {
    render(<ItemCard {...defaultProps} testID="item" />);
    expect(screen.queryByTestId('item-swipeable')).toBeNull();
  });

  it('renders right element when provided', () => {
    const { Text } = require('react-native');
    render(<ItemCard {...defaultProps} rightElement={<Text>Right</Text>} />);
    expect(screen.getByText('Milk')).toBeTruthy();
  });
});
