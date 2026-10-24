import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { render, screen, within } from '@testing-library/react-native';
import type { SwipeableItemProps } from '#components/organisms/SwipeableItem/types';
import { ItemCard } from '../ItemCard';

type MockListItemProps = {
  title?: string;
  subtitle?: string | React.ReactNode;
  badge?: { text: string };
};

jest.mock('#components/organisms/SwipeableItem/SwipeableItem', () => {
  const { View } = require('react-native');
  return {
    SwipeableItem: ({
      children,
      onPress,
      testIDPrefix,
    }: Pick<SwipeableItemProps, 'children' | 'onPress' | 'testIDPrefix'>) => (
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
    ListItem: ({ title, subtitle, badge }: MockListItemProps) => (
      <View>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
        {badge ? <Text>{badge.text}</Text> : null}
      </View>
    ),
  };
});

jest.mock('#components/atoms/ThemeEpochSentinel', () => {
  const { View } = require('react-native');
  return { ThemeEpochSentinel: () => <View testID="theme-epoch-sentinel" /> };
});

const mockUseSlideAnimation = jest.fn(() => ({
  animatedSlideStyle: {},
  triggerSlide: jest.fn((_: number, cb?: () => void) => cb?.()),
}));
jest.mock('#hooks/animations/useSlideAnimation', () => ({
  useSlideAnimation: () => mockUseSlideAnimation(),
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
    render(
      <ItemCard
        {...defaultProps}
        rightActions={[
          {
            key: 'edit',
            icon: 'create-outline',
            labelKey: 'labels.edit',
            onPress: jest.fn(),
          },
        ]}
        testID="item"
      />,
    );
    expect(screen.getByTestId('item-swipeable')).toBeTruthy();
  });

  it('renders SwipeableItem when delete action is provided', () => {
    render(
      <ItemCard
        {...defaultProps}
        rightActions={[
          {
            key: 'delete',
            icon: 'trash-outline',
            labelKey: 'labels.delete',
            onPress: jest.fn(),
          },
        ]}
        testID="item"
      />,
    );
    expect(screen.getByTestId('item-swipeable')).toBeTruthy();
  });

  // A card left outside the slide stays on screen, empty, as its row leaves.
  it('slides the whole card, its theme kept by a sentinel', () => {
    const slide = { transform: [{ translateX: 7 }] };
    mockUseSlideAnimation.mockReturnValueOnce({
      animatedSlideStyle: slide,
      triggerSlide: jest.fn(),
    });
    render(
      <ItemCard
        {...defaultProps}
        rightActions={[
          {
            key: 'delete',
            icon: 'trash-outline',
            labelKey: 'labels.delete',
            onPress: jest.fn(),
          },
        ]}
        testID="item"
      />,
    );

    let node = screen.getByTestId('item').parent;
    while (
      node &&
      StyleSheet.flatten(node.props.style)?.transform !== slide.transform
    ) {
      node = node.parent;
    }
    expect(node).not.toBeNull();
    expect(within(node!).getByTestId('theme-epoch-sentinel')).toBeTruthy();
  });

  it('renders without SwipeableItem when no swipe actions provided', () => {
    render(<ItemCard {...defaultProps} testID="item" />);
    expect(screen.queryByTestId('item-swipeable')).toBeNull();
  });

  it('skips the reanimated slide hook on the lightweight (no-action) path', () => {
    // Non-interactive rows (e.g. recipe discovery) must NOT spin up per-row
    // reanimated shared values — the hook only mounts for swipeable rows.
    render(<ItemCard {...defaultProps} testID="item" />);
    expect(mockUseSlideAnimation).not.toHaveBeenCalled();
  });

  it('mounts the reanimated slide hook only when a swipe action is provided', () => {
    render(
      <ItemCard
        {...defaultProps}
        rightActions={[
          {
            key: 'delete',
            icon: 'trash-outline',
            labelKey: 'labels.delete',
            onPress: jest.fn(),
          },
        ]}
        testID="item"
      />,
    );
    expect(mockUseSlideAnimation).toHaveBeenCalledTimes(1);
  });

  it('renders right element when provided', () => {
    const { Text } = require('react-native');
    render(<ItemCard {...defaultProps} rightElement={<Text>Right</Text>} />);
    expect(screen.getByText('Milk')).toBeTruthy();
  });
});
