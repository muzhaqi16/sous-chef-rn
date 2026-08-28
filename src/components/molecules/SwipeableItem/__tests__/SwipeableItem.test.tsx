'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SwipeableItem } from '../SwipeableItem';
import { Text } from '#components/atoms/Text';

// Actions are descriptors now, so the tests build them the way callers do.
const action = (
  key: string,
  onPress: () => void = jest.fn(),
  labelKey = 'labels.edit',
) => ({ key, icon: 'create-outline' as const, labelKey, onPress });

type TestInstance = ReturnType<typeof screen.getByTestId>;

jest.mock('../SwipeActions', () => ({
  SwipeActions: () => null,
  swipeTrayWidth: () => 80,
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

  it('renders with a single left action', () => {
    render(
      <SwipeableItem leftActions={[action('togglePurchase')]}>
        <Text>Shopping item</Text>
      </SwipeableItem>,
    );
    expect(screen.getByText('Shopping item')).toBeTruthy();
  });

  it('renders with a three-action tray', () => {
    render(
      <SwipeableItem
        leftActions={[action('consume'), action('waste'), action('restock')]}
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
          leftActions={[action('consume')]}
          rightActions={[action('edit'), action('delete')]}
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

    // The production shape: most rows pass no actions at all, so the component
    // renders through its default parameters. A fixture that always passes an
    // explicit list never exercises that path.
    it('exposes no accessibility actions when both lists are omitted', () => {
      render(
        <SwipeableItem>
          <Text>Item</Text>
        </SwipeableItem>,
      );
      const host = findA11yActionHost(screen.getByTestId('swipeable-content'));
      expect(host.props.accessibilityActions).toEqual([]);
    });

    it('tracks the action set when it changes', () => {
      const { rerender } = render(
        <SwipeableItem rightActions={[action('edit')]}>
          <Text>Item</Text>
        </SwipeableItem>,
      );
      let host = findA11yActionHost(screen.getByTestId('swipeable-content'));
      expect(
        host.props.accessibilityActions.map((a: { name: string }) => a.name),
      ).toEqual(['edit']);

      rerender(
        <SwipeableItem rightActions={[action('edit'), action('delete')]}>
          <Text>Item</Text>
        </SwipeableItem>,
      );
      host = findA11yActionHost(screen.getByTestId('swipeable-content'));
      expect(
        host.props.accessibilityActions.map((a: { name: string }) => a.name),
      ).toEqual(['edit', 'delete']);

      // ...and back to none, so the assistive surface cannot outlive the swipe
      // surface it mirrors.
      rerender(
        <SwipeableItem>
          <Text>Item</Text>
        </SwipeableItem>,
      );
      host = findA11yActionHost(screen.getByTestId('swipeable-content'));
      expect(host.props.accessibilityActions).toEqual([]);
    });

    it('omits actions for callbacks not provided', () => {
      render(
        <SwipeableItem rightActions={[action('edit')]}>
          <Text>Item</Text>
        </SwipeableItem>,
      );
      const host = findA11yActionHost(screen.getByTestId('swipeable-content'));
      const actionNames = host.props.accessibilityActions.map(
        (a: { name: string }) => a.name,
      );
      expect(actionNames).toEqual(['edit']);
    });

    // The label now comes from the action's own `labelKey`, so a caller can
    // vary it (purchased vs unpurchased) without this component knowing.
    it('resolves each action label from its i18n key', () => {
      render(
        <SwipeableItem
          rightActions={[action('delete', jest.fn(), 'labels.delete')]}
        >
          <Text>Item</Text>
        </SwipeableItem>,
      );
      const host = findA11yActionHost(screen.getByTestId('swipeable-content'));
      expect(host.props.accessibilityActions[0].label).toBe('Delete');
    });

    it('fires the edit callback on edit action', () => {
      const onEdit = jest.fn();
      render(
        <SwipeableItem
          rightActions={[action('edit', onEdit), action('delete')]}
        >
          <Text>Item</Text>
        </SwipeableItem>,
      );
      fireA11yAction('edit');
      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it('fires the delete callback on delete action', () => {
      const onDelete = jest.fn();
      render(
        <SwipeableItem
          rightActions={[action('edit'), action('delete', onDelete)]}
        >
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
          leftActions={[
            action('consume', onConsume),
            action('waste', onWaste),
            action('restock', onRestock),
          ]}
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
        <SwipeableItem
          leftActions={[action('togglePurchase', onTogglePurchase)]}
        >
          <Text>Item</Text>
        </SwipeableItem>,
      );
      fireA11yAction('togglePurchase');
      expect(onTogglePurchase).toHaveBeenCalledTimes(1);
    });

    it('ignores unknown action names without crashing', () => {
      const onEdit = jest.fn();
      render(
        <SwipeableItem rightActions={[action('edit', onEdit)]}>
          <Text>Item</Text>
        </SwipeableItem>,
      );
      expect(() => fireA11yAction('nonexistent')).not.toThrow();
      expect(onEdit).not.toHaveBeenCalled();
    });
  });
});
