'use no memo';
import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithApollo, seedCache } from '#/test-utils/apolloMockProvider';

/**
 * Row tests for `SwipeableListItem`.
 *
 * The row receives a `ShoppingListRowItem` (`id`, `isPurchased`, `sortOrder`,
 * `itemRef`) and calls `useFragment(SortableItem_item, itemRef)` internally.
 * The Apollo test wrapper provides a real `InMemoryCache` pre-seeded with the
 * `ShoppingListItem` record the ref points at, so `useFragment` resolves the
 * full SortableItem_item selection without any per-test mocking of the
 * Apollo client.
 */

// Records what the row passes down. The previous mock dropped every action
// prop, which is why a row rendering NO swipe actions looked identical to one
// rendering working ones.
const swipeableProps: {
  leftActions?: unknown[];
  rightActions?: unknown[];
}[] = [];

jest.mock('#/components/molecules/SwipeableItem/SwipeableItem', () => ({
  SwipeableItem: ({
    children,
    leftActions,
    rightActions,
  }: {
    children?: React.ReactNode;
    leftActions?: unknown[];
    rightActions?: unknown[];
  }) => {
    const { View } = require('react-native');
    swipeableProps.push({ leftActions, rightActions });
    return <View testID="swipeable-item">{children}</View>;
  },
}));

jest.mock('#/components/molecules/ListItem', () => ({
  ListItem: ({
    title,
    subtitle,
    checkboxElement,
    leftElement,
    rightElement,
  }: {
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    checkboxElement?: React.ReactNode;
    leftElement?: React.ReactNode;
    rightElement?: React.ReactNode;
  }) => {
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
  AnimatedCheckbox: ({
    checked,
    testID,
  }: {
    checked?: boolean;
    testID?: string;
  }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={testID}>
        <Text>{checked ? 'checked' : 'unchecked'}</Text>
      </View>
    );
  },
}));

jest.mock('#/components/atoms/QuantityBadge', () => ({
  QuantityBadge: ({
    quantity,
    unit,
  }: {
    quantity?: number;
    unit?: string | null;
  }) => {
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
      itemSwipeActions: jest.fn(),
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
    permissionsRef: {
      current: {
        canRemoveItems: true,
        canEditItems: true,
        canMarkPurchased: true,
      },
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
  useShoppingListRowOptions: jest.fn(() => ({ showImages: true })),
}));

jest.mock('#features/shoppingList/context/ShoppingListTutorialContext', () => {
  const actual = jest.requireActual(
    '#features/shoppingList/context/ShoppingListTutorialContext',
  );
  return {
    ...actual,
    useShoppingListTutorialState: jest.fn(),
    useShoppingListTutorialActions: jest.fn(),
  };
});

// Import after mocks
import { SwipeableListItem } from '../SortableItem';
import { SortableItem_ItemFragmentDoc } from '../SortableItem.generated';
import type { FragmentType } from '@apollo/client/masking';
import type { ShoppingListRowItem } from '../types';
import { useSortableListActions } from '../SortableListActionsContext';
import {
  useShoppingListTutorialState,
  useShoppingListTutorialActions,
  ShoppingListTutorialStep,
} from '#features/shoppingList/context/ShoppingListTutorialContext';

// Build a ShoppingListItem cache entry that satisfies the SortableItem_item
// fragment selection. Passing the entry's `__typename`/`id` ref as `itemRef`
// lets `useFragment` resolve the seeded entity.
function seedItem(overrides: Record<string, unknown> = {}) {
  const entry: { __typename: 'ShoppingListItem'; id: string } & Record<
    string,
    unknown
  > = {
    __typename: 'ShoppingListItem',
    id: 'item-1',
    itemName: 'Milk',
    quantity: 1,
    quantityInput: null,
    category: '2 liters',
    unitName: null,
    unit: null,
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: false,
    },
    item: null,
    ...overrides,
  };
  return entry;
}

function rowItem(
  entry: ReturnType<typeof seedItem>,
  isPurchased = false,
): ShoppingListRowItem {
  return {
    id: entry.id,
    isPurchased,
    sortOrder: 'a',
    // The masked ref is structurally a normalized ref: __typename + id is
    // enough for useFragment's cache lookup.
    itemRef: { __typename: entry.__typename, id: entry.id } as FragmentType<
      typeof SortableItem_ItemFragmentDoc
    >,
  };
}

const mockRegisterRect = jest.fn();

describe('SwipeableListItem (SortableItem)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useShoppingListTutorialState as jest.Mock).mockReturnValue({
      currentStep: ShoppingListTutorialStep.IDLE,
      isActive: false,
      rects: {},
    });
    (useShoppingListTutorialActions as jest.Mock).mockReturnValue({
      registerRect: mockRegisterRect,
      notifyCheckboxTapped: jest.fn(),
      notifyMoveToPantryTapped: jest.fn(),
      notifySwipeActionsSeen: jest.fn(),
    });
  });

  it('renders the item title from the fragment', () => {
    const entry = seedItem();
    renderWithApollo(
      <SwipeableListItem item={rowItem(entry)} index={0} target="Cell" />,
      {
        cache: seedCache([entry]),
      },
    );
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders the item subtitle derived from category', () => {
    const entry = seedItem();
    renderWithApollo(
      <SwipeableListItem item={rowItem(entry)} index={0} target="Cell" />,
      {
        cache: seedCache([entry]),
      },
    );
    expect(screen.getByText('2 liters')).toBeTruthy();
  });

  it('renders a swipeable wrapper', () => {
    const entry = seedItem();
    renderWithApollo(
      <SwipeableListItem item={rowItem(entry)} index={0} target="Cell" />,
      {
        cache: seedCache([entry]),
      },
    );
    expect(screen.getByTestId('swipeable-item')).toBeTruthy();
  });

  it('renders a list item', () => {
    const entry = seedItem();
    renderWithApollo(
      <SwipeableListItem item={rowItem(entry)} index={0} target="Cell" />,
      {
        cache: seedCache([entry]),
      },
    );
    expect(screen.getByTestId('list-item')).toBeTruthy();
  });

  it('renders checkbox with unchecked state for unpurchased items', () => {
    const entry = seedItem();
    renderWithApollo(
      <SwipeableListItem item={rowItem(entry)} index={0} target="Cell" />,
      {
        cache: seedCache([entry]),
      },
    );
    expect(screen.getByTestId('shopping-item-checkbox-item-1')).toBeTruthy();
    expect(screen.getByText('unchecked')).toBeTruthy();
  });

  it('renders checkbox with checked state for purchased items', () => {
    const entry = seedItem();
    renderWithApollo(
      <SwipeableListItem item={rowItem(entry, true)} index={0} target="Cell" />,
      { cache: seedCache([entry]) },
    );
    expect(screen.getByText('checked')).toBeTruthy();
  });

  it('renders the quantity badge with the cached quantity + unit', () => {
    const entry = seedItem({ quantity: 3, unitName: 'pcs' });
    renderWithApollo(
      <SwipeableListItem item={rowItem(entry)} index={0} target="Cell" />,
      {
        cache: seedCache([entry]),
      },
    );
    expect(screen.getByTestId('quantity-badge')).toBeTruthy();
    expect(screen.getByText('3 pcs')).toBeTruthy();
  });

  it('renders a stable empty cell without crashing when FlashList recycles an undefined item', () => {
    // FlashList v2 can transiently call renderItem with item === undefined while
    // recycling cells during a layout-animation render (toggle/delete shrinks
    // the data array). The row must degrade to an empty cell, not throw.
    renderWithApollo(
      // @ts-expect-error — intentionally simulating FlashList's recycled
      // undefined item, which violates the ListRenderItemInfo type at runtime.
      <SwipeableListItem item={undefined} index={0} target="Cell" />,
    );
    expect(screen.queryByTestId('list-item')).toBeNull();
    expect(screen.queryByTestId('swipeable-item')).toBeNull();
  });

  describe('swipe actions reach the row', () => {
    const setActions = (
      itemSwipeActions: unknown,
      permissions = {
        canRemoveItems: true,
        canEditItems: true,
        canMarkPurchased: true,
      },
    ) => {
      (useSortableListActions as jest.Mock).mockReturnValue({
        actions: {
          onItemPress: jest.fn(),
          itemSwipeActions,
          onTogglePurchase: jest.fn(),
          onMoveToPantry: jest.fn(),
          onQuantityPress: jest.fn(),
          onSwipeableWillOpen: jest.fn(),
          onSwipeableClose: jest.fn(),
        },
        permissions,
        permissionsRef: { current: permissions },
      });
    };

    beforeEach(() => {
      swipeableProps.length = 0;
    });

    it('renders the edit and delete descriptors the screen supplies', () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      setActions((id: string) => ({
        left: [
          { key: 'edit', labelKey: 'labels.edit', onPress: () => onEdit(id) },
        ],
        right: [
          {
            key: 'delete',
            labelKey: 'labels.delete',
            onPress: () => onDelete(id),
            removesRow: true,
          },
        ],
      }));

      const entry = seedItem();
      renderWithApollo(
        <SwipeableListItem item={rowItem(entry)} index={0} target="Cell" />,
        { cache: seedCache([entry]) },
      );

      const last = swipeableProps[swipeableProps.length - 1];
      expect(last.leftActions).toHaveLength(1);
      expect(last.rightActions).toHaveLength(1);

      // The descriptor must carry the screen's handler, not a wrapper that
      // silently no-ops — that is the shape the dead buttons had.
      (last.leftActions as { onPress: () => void }[])[0].onPress();
      expect(onEdit).toHaveBeenCalledWith(entry.id);
      (last.rightActions as { onPress: () => void }[])[0].onPress();
      expect(onDelete).toHaveBeenCalledWith(entry.id);
    });

    it('renders no actions when the screen supplies no factory', () => {
      setActions(undefined);

      const entry = seedItem();
      renderWithApollo(
        <SwipeableListItem item={rowItem(entry)} index={0} target="Cell" />,
        { cache: seedCache([entry]) },
      );

      const last = swipeableProps[swipeableProps.length - 1];
      expect(last.leftActions).toBeUndefined();
      expect(last.rightActions).toBeUndefined();
    });

    it('withholds edit and delete that the permissions forbid', () => {
      setActions(
        () => ({
          left: [{ key: 'edit', labelKey: 'labels.edit', onPress: jest.fn() }],
          right: [
            { key: 'delete', labelKey: 'labels.delete', onPress: jest.fn() },
          ],
        }),
        { canRemoveItems: false, canEditItems: false, canMarkPurchased: true },
      );

      const entry = seedItem();
      renderWithApollo(
        <SwipeableListItem item={rowItem(entry)} index={0} target="Cell" />,
        { cache: seedCache([entry]) },
      );

      const last = swipeableProps[swipeableProps.length - 1];
      expect(last.leftActions).toBeUndefined();
      expect(last.rightActions).toBeUndefined();
    });
  });

  describe('tutorial rect cleanup', () => {
    // registerRect only ever sets a value — nothing else clears a rect once
    // its owning row stops being the tutorial's target (item purchased/
    // removed, step advances). Without an explicit clear, the coach mark can
    // render pointing at a target that no longer exists — the root cause
    // behind several reported "spotlight stuck on the wrong thing" bugs.

    it('clears the checkbox rect once the spotlighted item is purchased', () => {
      const entry = seedItem();
      (useShoppingListTutorialState as jest.Mock).mockReturnValue({
        currentStep: ShoppingListTutorialStep.SPOTLIGHT_CHECKBOX,
        isActive: true,
        rects: {},
      });
      const { rerender } = renderWithApollo(
        <SwipeableListItem
          item={rowItem(entry, false)}
          index={0}
          target="Cell"
        />,
        { cache: seedCache([entry]) },
      );
      expect(mockRegisterRect).not.toHaveBeenCalledWith('checkbox', null);

      rerender(
        <SwipeableListItem
          item={rowItem(entry, true)}
          index={0}
          target="Cell"
        />,
      );
      expect(mockRegisterRect).toHaveBeenCalledWith('checkbox', null);
    });

    it('clears the archiveIcon rect once the spotlighted item leaves the purchased tab', () => {
      const entry = seedItem();
      (useShoppingListTutorialState as jest.Mock).mockReturnValue({
        currentStep: ShoppingListTutorialStep.SPOTLIGHT_MOVE_TO_PANTRY,
        isActive: true,
        rects: {},
      });
      const { rerender } = renderWithApollo(
        <SwipeableListItem
          item={rowItem(entry, true)}
          index={0}
          target="Cell"
        />,
        { cache: seedCache([entry]) },
      );
      expect(mockRegisterRect).not.toHaveBeenCalledWith('archiveIcon', null);

      rerender(
        <SwipeableListItem
          item={rowItem(entry, false)}
          index={0}
          target="Cell"
        />,
      );
      expect(mockRegisterRect).toHaveBeenCalledWith('archiveIcon', null);
    });

    it('clears the itemCard rect once the tutorial advances past the long-press step', () => {
      const entry = seedItem();
      (useShoppingListTutorialState as jest.Mock).mockReturnValue({
        currentStep: ShoppingListTutorialStep.SPOTLIGHT_LONG_PRESS_PRICE,
        isActive: true,
        rects: {},
      });
      const { rerender } = renderWithApollo(
        <SwipeableListItem
          item={rowItem(entry, false)}
          index={0}
          target="Cell"
        />,
        { cache: seedCache([entry]) },
      );
      expect(mockRegisterRect).not.toHaveBeenCalledWith('itemCard', null);

      (useShoppingListTutorialState as jest.Mock).mockReturnValue({
        currentStep: ShoppingListTutorialStep.SPOTLIGHT_PURCHASED_TAB,
        isActive: true,
        rects: {},
      });
      rerender(
        <SwipeableListItem
          item={rowItem(entry, false)}
          index={0}
          target="Cell"
        />,
      );
      expect(mockRegisterRect).toHaveBeenCalledWith('itemCard', null);
    });
  });
});
