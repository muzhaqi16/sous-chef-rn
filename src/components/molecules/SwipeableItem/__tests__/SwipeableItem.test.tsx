'use no memo';
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SwipeableItem } from '../SwipeableItem';

jest.mock('../RightActions', () => ({
  RightActions: () => null,
}));

jest.mock('../LeftActions', () => ({
  LeftActions: () => null,
}));

jest.mock('../SwipeableContent', () => ({
  SwipeableContent: ({ children }: any) => {
    const { View } = require('react-native');
    return require('react').createElement(View, { testID: 'swipeable-content' }, children);
  },
}));

jest.mock('../hooks/useSwipeableActions', () => ({
  useSwipeableActions: jest.fn(() => ({
    swipeableRef: { current: null },
    handleActionPress: jest.fn(),
    handleSwipeableWillOpen: jest.fn(),
    handleSwipeableClose: jest.fn(),
  })),
}));

jest.mock('../styles', () => ({
  styles: {
    gestureContainer: {},
    swipeableContainer: {},
    childrenContainer: {},
  },
}));

describe('SwipeableItem', () => {
  const defaultProps = {
    onPress: jest.fn(),
    onDelete: jest.fn(),
    onEdit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children content', () => {
    render(
      <SwipeableItem {...defaultProps}>
        <Text>Item content</Text>
      </SwipeableItem>,
    );
    expect(screen.getByText('Item content')).toBeTruthy();
  });

  it('renders the swipeable content wrapper', () => {
    render(
      <SwipeableItem {...defaultProps}>
        <Text>Hello</Text>
      </SwipeableItem>,
    );
    expect(screen.getByTestId('swipeable-content')).toBeTruthy();
  });

  it('renders without optional callbacks', () => {
    render(
      <SwipeableItem>
        <Text>Basic item</Text>
      </SwipeableItem>,
    );
    expect(screen.getByText('Basic item')).toBeTruthy();
  });

  it('renders with purchase toggle callback', () => {
    render(
      <SwipeableItem onTogglePurchase={jest.fn()} isPurchased={false}>
        <Text>Shopping item</Text>
      </SwipeableItem>,
    );
    expect(screen.getByText('Shopping item')).toBeTruthy();
  });

  it('renders with pantry callbacks', () => {
    render(
      <SwipeableItem onConsume={jest.fn()} onWaste={jest.fn()} onRestock={jest.fn()}>
        <Text>Pantry item</Text>
      </SwipeableItem>,
    );
    expect(screen.getByText('Pantry item')).toBeTruthy();
  });
});
