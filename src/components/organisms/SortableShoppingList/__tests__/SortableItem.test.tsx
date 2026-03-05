'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('#/components/molecules/SwipeableItem/ShoppingSwipeable', () => ({
  ShoppingSwipeable: ({ children }: any) => {
    const { View } = require('react-native');
    return <View testID="swipeable-item">{children}</View>;
  },
}));

jest.mock('#/components/molecules/ListItem', () => ({
  ListItem: ({ title, subtitle, checkboxElement, leftElement, rightElement }: any) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="list-item">
        {checkboxElement}
        {leftElement}
        <Text>{title}</Text>
        {typeof subtitle === 'string' && <Text>{subtitle}</Text>}
        {rightElement}
      </View>
    );
  },
}));

jest.mock('#/components/atoms/AnimatedCheckbox', () => ({
  AnimatedCheckbox: ({ checked, testID }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={testID}>
        <Text>{checked ? 'checked' : 'unchecked'}</Text>
      </View>
    );
  },
}));

jest.mock('#/components/atoms/QuantityBadge', () => ({
  QuantityBadge: ({ quantity, unit }: any) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="quantity-badge">
        <Text>{`${quantity} ${unit || ''}`}</Text>
      </View>
    );
  },
}));

jest.mock('#/components/atoms/CachedImage', () => ({
  CachedImage: () => {
    const { View } = require('react-native');
    return <View testID="cached-image" />;
  },
}));

jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    shadow: {},
    listItemImageContainerCompact: {},
    listItemImageCompact: {},
  },
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#utils/memoUtils', () => ({
  createPropsComparator: () => () => false,
}));

jest.mock('#/constants/touch', () => ({
  HIT_SLOP: { top: 8, bottom: 8, left: 8, right: 8 },
}));

jest.mock('#hooks/animations/useSlideAnimation', () => ({
  useSlideAnimation: jest.fn(() => ({
    animatedSlideStyle: {},
    triggerSlide: jest.fn(),
  })),
}));

jest.mock('#constants/animations', () => ({
  standardEasing: { factory: jest.fn(() => jest.fn()) },
  staggeredEntryAnimation: { duration: 300 },
  TIMING: { MODERATE: 300 },
}));

jest.mock('#context/StaggeredEntryContext', () => ({
  useStaggeredEntry: jest.fn(() => ({
    getEntryDelay: jest.fn(() => 0),
  })),
}));

jest.mock('../SortableListActionsContext', () => ({
  useSortableListActions: jest.fn(() => ({
    actions: {
      onItemPress: jest.fn(),
      onItemEdit: jest.fn(),
      onItemDelete: jest.fn(),
      onTogglePurchase: jest.fn(),
      onMoveToPantry: jest.fn(),
      onQuantityPress: jest.fn(),
      onSwipeableWillOpen: jest.fn(),
      onSwipeableClose: jest.fn(),
    },
    permissions: {
      canRemoveItems: true,
      canEditItems: true,
      canMarkPurchased: true,
    },
  })),
}));

jest.mock('../SortableListThemeContext', () => ({
  useSortableListTheme: jest.fn(() => ({
    primary: '#007AFF',
    textPrimary: '#000',
    textSecondary: '#666',
    screenWidth: 375,
  })),
}));

// Import after mocks
import { SwipeableListItem as _SwipeableListItem } from '../SortableItem';
const SwipeableListItem = _SwipeableListItem as any;

const defaultItem = {
  id: 'item-1',
  title: 'Milk',
  subtitle: '2 liters',
  isPurchased: false,
};

describe('SwipeableListItem (SortableItem)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the item title', () => {
    render(<SwipeableListItem item={defaultItem} index={0} />);
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders the item subtitle', () => {
    render(<SwipeableListItem item={defaultItem} index={0} />);
    expect(screen.getByText('2 liters')).toBeTruthy();
  });

  it('renders a swipeable wrapper', () => {
    render(<SwipeableListItem item={defaultItem} index={0} />);
    expect(screen.getByTestId('swipeable-item')).toBeTruthy();
  });

  it('renders a list item', () => {
    render(<SwipeableListItem item={defaultItem} index={0} />);
    expect(screen.getByTestId('list-item')).toBeTruthy();
  });

  it('renders checkbox with unchecked state for unpurchased items', () => {
    render(<SwipeableListItem item={defaultItem} index={0} />);
    expect(
      screen.getByTestId(`shopping-item-checkbox-${defaultItem.id}`),
    ).toBeTruthy();
    expect(screen.getByText('unchecked')).toBeTruthy();
  });

  it('renders checkbox with checked state for purchased items', () => {
    render(
      <SwipeableListItem
        item={{ ...defaultItem, isPurchased: true }}
        index={0}
      />,
    );
    expect(screen.getByText('checked')).toBeTruthy();
  });

  it('renders with rightElementConfig when provided', () => {
    const item = {
      ...defaultItem,
      rightElementConfig: {
        type: 'quantity' as const,
        quantity: 3,
        quantityInput: '3',
        unit: 'pcs',
        itemId: 'item-1',
        disabled: false,
      },
    };
    render(<SwipeableListItem item={item} index={0} />);
    // Component renders without crashing with quantity config
    expect(screen.getByTestId('list-item')).toBeTruthy();
  });

  it('renders with leftElementConfig when provided', () => {
    const item = {
      ...defaultItem,
      leftElementConfig: {
        type: 'image' as const,
        url: 'https://example.com/image.jpg',
        isPurchased: false,
      },
    };
    render(<SwipeableListItem item={item} index={0} />);
    // Component renders without crashing with image config
    expect(screen.getByTestId('list-item')).toBeTruthy();
  });
});
