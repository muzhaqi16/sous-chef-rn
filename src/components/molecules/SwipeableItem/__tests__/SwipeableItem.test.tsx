'use no memo';
import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SwipeableItem } from '../SwipeableItem';

type TestInstance = ReturnType<typeof screen.getByTestId>;

jest.mock('../RightActions', () => ({
  RightActions: () => null,
}));

jest.mock('../LeftActions', () => ({
  LeftActions: () => null,
}));

jest.mock('../SwipeableContent', () => ({
  SwipeableContent: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return require('react').createElement(
      View,
      { testID: 'swipeable-content' },
      children,
    );
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

// Walk up from a known descendant to the view that owns onAccessibilityAction.
const findA11yActionHost = (start: TestInstance): TestInstance => {
  let node: TestInstance | null = start;
  while (node && !node.props?.onAccessibilityAction) {
    node = node.parent;
  }
  if (!node) throw new Error('No accessibility action host found');
  return node;
};

const fireA11yAction = (actionName: string) => {
  const host = findA11yActionHost(screen.getByTestId('swipeable-content'));
  fireEvent(host, 'accessibilityAction', {
    nativeEvent: { actionName },
  });
};

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
      <SwipeableItem
        onConsume={jest.fn()}
        onWaste={jest.fn()}
        onRestock={jest.fn()}
      >
        <Text>Pantry item</Text>
      </SwipeableItem>,
    );
    expect(screen.getByText('Pantry item')).toBeTruthy();
  });

  describe('accessibility actions', () => {
    it('exposes available action callbacks as accessibilityActions', () => {
      render(
        <SwipeableItem
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onConsume={jest.fn()}
        >
          <Text>Item</Text>
        </SwipeableItem>,
      );
      const host = findA11yActionHost(screen.getByTestId('swipeable-content'));
      const actionNames = host.props.accessibilityActions.map(
        (a: { name: string }) => a.name,
      );
      expect(actionNames).toEqual(
        expect.arrayContaining(['edit', 'delete', 'consume']),
      );
    });

    it('omits actions for callbacks not provided', () => {
      render(
        <SwipeableItem onEdit={jest.fn()}>
          <Text>Item</Text>
        </SwipeableItem>,
      );
      const host = findA11yActionHost(screen.getByTestId('swipeable-content'));
      const actionNames = host.props.accessibilityActions.map(
        (a: { name: string }) => a.name,
      );
      expect(actionNames).toEqual(['edit']);
    });

    it('toggles label between purchased and unpurchased states', () => {
      const { rerender } = render(
        <SwipeableItem onTogglePurchase={jest.fn()} isPurchased={false}>
          <Text>Item</Text>
        </SwipeableItem>,
      );
      const hostUnpurchased = findA11yActionHost(
        screen.getByTestId('swipeable-content'),
      );
      const labelUnpurchased = hostUnpurchased.props.accessibilityActions.find(
        (a: { name: string }) => a.name === 'togglePurchase',
      ).label;
      expect(labelUnpurchased).toBe('Mark as purchased');

      rerender(
        <SwipeableItem onTogglePurchase={jest.fn()} isPurchased>
          <Text>Item</Text>
        </SwipeableItem>,
      );
      const hostPurchased = findA11yActionHost(
        screen.getByTestId('swipeable-content'),
      );
      const labelPurchased = hostPurchased.props.accessibilityActions.find(
        (a: { name: string }) => a.name === 'togglePurchase',
      ).label;
      expect(labelPurchased).toBe('Mark as unpurchased');
    });

    it('fires the edit callback on edit action', () => {
      const onEdit = jest.fn();
      render(
        <SwipeableItem onEdit={onEdit} onDelete={jest.fn()}>
          <Text>Item</Text>
        </SwipeableItem>,
      );
      fireA11yAction('edit');
      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it('fires the delete callback on delete action', () => {
      const onDelete = jest.fn();
      render(
        <SwipeableItem onEdit={jest.fn()} onDelete={onDelete}>
          <Text>Item</Text>
        </SwipeableItem>,
      );
      fireA11yAction('delete');
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('fires consume/waste/restock callbacks on their actions', () => {
      const onConsume = jest.fn();
      const onWaste = jest.fn();
      const onRestock = jest.fn();
      render(
        <SwipeableItem
          onConsume={onConsume}
          onWaste={onWaste}
          onRestock={onRestock}
        >
          <Text>Item</Text>
        </SwipeableItem>,
      );
      fireA11yAction('consume');
      fireA11yAction('waste');
      fireA11yAction('restock');
      expect(onConsume).toHaveBeenCalledTimes(1);
      expect(onWaste).toHaveBeenCalledTimes(1);
      expect(onRestock).toHaveBeenCalledTimes(1);
    });

    it('fires togglePurchase callback when triggered', () => {
      const onTogglePurchase = jest.fn();
      render(
        <SwipeableItem onTogglePurchase={onTogglePurchase} isPurchased={false}>
          <Text>Item</Text>
        </SwipeableItem>,
      );
      fireA11yAction('togglePurchase');
      expect(onTogglePurchase).toHaveBeenCalledTimes(1);
    });

    it('ignores unknown action names without crashing', () => {
      const onEdit = jest.fn();
      render(
        <SwipeableItem onEdit={onEdit}>
          <Text>Item</Text>
        </SwipeableItem>,
      );
      expect(() => fireA11yAction('nonexistent')).not.toThrow();
      expect(onEdit).not.toHaveBeenCalled();
    });
  });
});
