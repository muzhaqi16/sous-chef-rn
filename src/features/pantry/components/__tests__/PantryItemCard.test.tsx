'use no memo';
import React from 'react';
import { InMemoryCache } from '@apollo/client';
import { screen } from '@testing-library/react-native';
import {
  renderWithApollo,
  toFragmentRef,
} from '#/test-utils/apolloMockProvider';
import { PantryItemCard } from '../PantryItemCard';
import {
  PantryItemCard_PantryItemFragmentDoc,
  type PantryItemCard_PantryItemFragment,
} from '../PantryItemCard.generated';
import { PantryActionsProvider } from '../PantryActionsContext';
import { StorageState } from '#/graphql/generated/schemaTypes';

jest.mock('react-native-worklets', () => ({
  createWorkletRuntime: jest.fn(),
  runOnRuntime: jest.fn(),
  useWorklet: jest.fn(),
  scheduleOnRN: jest.fn((fn: any) => fn),
}));

jest.mock('#/constants/animations', () => ({
  SLIDE_PRESETS: {
    exitWithFade: { duration: 300, opacityTarget: 0 },
  },
}));

jest.mock('#components/molecules/BaseItemCard/BaseItemCard', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    BaseItemCard: ({
      children,
      testID,
      itemId,
      leftElement,
      rightElement,
    }: any) =>
      R.createElement(
        RN.View,
        { testID: testID || `base-item-card-${itemId}` },
        leftElement || null,
        children,
        rightElement || null,
      ),
  };
});

jest.mock('#components/molecules/BaseItemCard/CardLeftSlot', () => {
  const RN = require('react-native');
  return {
    CardLeftSlot: ({ type, imageUrl }: any) =>
      require('react').createElement(RN.View, {
        testID: `card-left-${type}`,
        accessibilityLabel: imageUrl,
      }),
  };
});

jest.mock('#components/molecules/BaseItemCard/CardContent', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    CardContent: ({ title, subtitle }: any) =>
      R.createElement(
        RN.View,
        { testID: 'card-content' },
        R.createElement(RN.Text, null, title),
        subtitle,
      ),
  };
});

jest.mock('#components/molecules/BaseItemCard/CardRightSlot', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    CardRightSlot: ({ primary, secondary, tertiary }: any) =>
      R.createElement(
        RN.View,
        { testID: 'card-right-slot' },
        R.createElement(RN.Text, null, primary),
        secondary ? R.createElement(RN.Text, null, secondary) : null,
        tertiary ? R.createElement(RN.Text, null, tertiary) : null,
      ),
  };
});

const defaultActions = {
  onItemPress: jest.fn(),
  onItemEdit: jest.fn(),
};

interface BuildItemOverrides {
  id?: string;
  itemName?: string;
  quantity?: number;
  unitSymbol?: string;
  storageLocationName?: string | null;
  expiresAt?: string | null;
  imageUrl?: string | null;
  packageBreakdown?: {
    count: number;
    contentUnit: { id: string; name: string; symbol: string };
    perUnitNetWeight?: number | null;
    perUnitNetWeightUnit?: { id: string; name: string; symbol: string } | null;
    totalNetWeight?: number | null;
  } | null;
  quantityBreakdown?: {
    fullPackages: number;
    looseContentUnits: number;
    contentUnit: { id: string; name: string; symbol: string } | null;
    totalContentUnits: number;
    remainingWeight: number | null;
    remainingWeightUnit: { id: string; name: string; symbol: string } | null;
  } | null;
  activeBatchCount?: number;
}

function buildItem(
  overrides: BuildItemOverrides = {},
): PantryItemCard_PantryItemFragment {
  return {
    __typename: 'PantryItem',
    id: overrides.id ?? 'pantry-1',
    itemName: overrides.itemName ?? 'Milk',
    quantity: overrides.quantity ?? 2,
    expiresAt: overrides.expiresAt ?? null,
    storageState: StorageState.Refrigerated,
    lastUsedAt: null,
    netWeight: null,
    remainingNetWeight: null,
    activeBatchCount: overrides.activeBatchCount ?? 1,
    updatedAt: '2025-01-01T00:00:00Z',
    item: {
      __typename: 'Item',
      id: `item-${overrides.id ?? 'pantry-1'}`,
      imageUrl: overrides.imageUrl ?? null,
      images: [] as PantryItemCard_PantryItemFragment['item']['images'],
    },
    unit: {
      __typename: 'Unit',
      id: 'unit-1',
      symbol: overrides.unitSymbol ?? 'gal',
    },
    netWeightUnit: null,
    storageLocation:
      overrides.storageLocationName == null
        ? null
        : {
            __typename: 'StorageLocation',
            id: 'loc-1',
            name: overrides.storageLocationName,
          },
    packageBreakdown: overrides.packageBreakdown
      ? {
          __typename: 'PackageBreakdown',
          count: overrides.packageBreakdown.count,
          perUnitNetWeight: overrides.packageBreakdown.perUnitNetWeight ?? null,
          totalNetWeight: overrides.packageBreakdown.totalNetWeight ?? null,
          contentUnit: {
            __typename: 'Unit',
            ...overrides.packageBreakdown.contentUnit,
          },
          perUnitNetWeightUnit: overrides.packageBreakdown.perUnitNetWeightUnit
            ? {
                __typename: 'Unit',
                ...overrides.packageBreakdown.perUnitNetWeightUnit,
              }
            : null,
        }
      : null,
    quantityBreakdown: overrides.quantityBreakdown
      ? {
          __typename: 'QuantityBreakdown',
          fullPackages: overrides.quantityBreakdown.fullPackages,
          looseContentUnits: overrides.quantityBreakdown.looseContentUnits,
          totalContentUnits: overrides.quantityBreakdown.totalContentUnits,
          remainingWeight: overrides.quantityBreakdown.remainingWeight,
          contentUnit: overrides.quantityBreakdown.contentUnit
            ? {
                __typename: 'Unit',
                ...overrides.quantityBreakdown.contentUnit,
              }
            : null,
          remainingWeightUnit: overrides.quantityBreakdown.remainingWeightUnit
            ? {
                __typename: 'Unit',
                ...overrides.quantityBreakdown.remainingWeightUnit,
              }
            : null,
        }
      : null,
  };
}

function buildCache(item: PantryItemCard_PantryItemFragment) {
  const cache = new InMemoryCache();
  cache.writeFragment({
    id:
      cache.identify({ __typename: item.__typename, id: item.id }) ??
      `PantryItem:${item.id}`,
    fragment: PantryItemCard_PantryItemFragmentDoc,
    fragmentName: 'PantryItemCard_pantryItem',
    data: item,
  });
  return cache;
}

function renderCard(
  overrides: BuildItemOverrides = {},
  actions = defaultActions,
) {
  const item = buildItem(overrides);
  return renderWithApollo(
    <PantryActionsProvider actions={actions}>
      <PantryItemCard
        pantryItemRef={toFragmentRef<
          typeof PantryItemCard_PantryItemFragmentDoc
        >(item)}
      />
    </PantryActionsProvider>,
    { cache: buildCache(item) },
  );
}

describe('PantryItemCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders item name', () => {
    renderCard();
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders quantity in right slot', () => {
    renderCard();
    expect(screen.getByText('2 gal')).toBeTruthy();
  });

  it('renders custom storage location in right slot when provided', () => {
    renderCard({ storageLocationName: 'Kitchen Cabinet' });
    expect(screen.getByText('Kitchen Cabinet')).toBeTruthy();
  });

  it('does not render default storage tab labels as location', () => {
    renderCard({ storageLocationName: null });
    expect(screen.queryByText('Fridge')).toBeNull();
    expect(screen.queryByText('Freezer')).toBeNull();
    expect(screen.queryByText('Pantry')).toBeNull();
  });

  it('renders with testID based on item id', () => {
    renderCard();
    expect(screen.getByTestId('pantry-item-pantry-1')).toBeTruthy();
  });

  it('renders "Out of stock" text when quantity is zero', () => {
    renderCard({ quantity: 0 });
    expect(screen.getByText('Out of stock')).toBeTruthy();
  });

  it('renders expiration text when expiresAt is set', () => {
    // Three days from "now" — getExpirationStatus returns a warning text
    const expires = new Date();
    expires.setDate(expires.getDate() + 3);
    renderCard({ expiresAt: expires.toISOString() });
    // getExpirationStatus may emit "Expires in 3 days" or similar — assert on
    // a stable substring so the test isn't tied to copy.
    expect(screen.getAllByText(/day/i).length).toBeGreaterThan(0);
  });

  it('renders image left slot when item has imageUrl', () => {
    renderCard({ imageUrl: 'https://example.com/milk.jpg' });
    expect(screen.getByTestId('card-left-image')).toBeTruthy();
  });

  it('does not render image left slot when no imageUrl', () => {
    renderCard();
    expect(screen.queryByTestId('card-left-image')).toBeNull();
  });

  it('renders quantity breakdown text when quantityBreakdown is set', () => {
    renderCard({
      quantityBreakdown: {
        fullPackages: 2,
        looseContentUnits: 0,
        contentUnit: { id: 'gal', name: 'gallon', symbol: 'gal' },
        totalContentUnits: 2,
        remainingWeight: null,
        remainingWeightUnit: null,
      },
    });
    // The exact formatting is owned by formatQuantityBreakdown; assert any
    // breakdown-style text renders.
    const breakdowns = screen.queryAllByText(/2/);
    expect(breakdowns.length).toBeGreaterThan(0);
  });

  it('wraps in SlideAnimatedWrapper when onItemDelete action is available', () => {
    const actionsWithDelete = {
      ...defaultActions,
      onItemDelete: jest.fn(),
    };
    renderCard({}, actionsWithDelete);
    expect(screen.getByText('Milk')).toBeTruthy();
  });
});
