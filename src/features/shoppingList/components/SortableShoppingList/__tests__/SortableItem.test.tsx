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

jest.mock('#/components/molecules/SwipeableItem/SwipeableItem', () => ({
  SwipeableItem: ({ children }: { children?: React.ReactNode }) => {
    const { View } = require('react-native');
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

// Import after mocks
import { SwipeableListItem } from '../SortableItem';
import { SortableItem_ItemFragmentDoc } from '../SortableItem.generated';
import type { FragmentType } from '@apollo/client/masking';
import type { ShoppingListRowItem } from '../types';

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

describe('SwipeableListItem (SortableItem)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
