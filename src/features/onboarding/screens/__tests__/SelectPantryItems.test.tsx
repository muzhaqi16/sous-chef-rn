'use no memo';

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { makeCache } from '#/apollo/cache';
import { SelectPantryItems } from '../SelectPantryItems';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockNavigateToNextStep = jest.fn();
const mockNavigateToPreviousStep = jest.fn();
jest.mock('#features/onboarding/hooks/useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
    navigateToPreviousStep: mockNavigateToPreviousStep,
  }),
}));

jest.mock('#store/useAppStore', () => {
  const fn = (selector: (state: { selectedPantryId: string }) => unknown) =>
    selector({ selectedPantryId: 'p1' });
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return { useAppStore: fn, useSelectedPantryId: jest.fn(() => 'p1') };
});

const mockItems = [
  {
    id: 'i1',
    name: 'Eggs',
    imageUrl: null,
    displayUnit: { id: 'u1', name: 'count' },
    selected: false,
  },
  {
    id: 'i2',
    name: 'Milk',
    imageUrl: null,
    displayUnit: { id: 'u2', name: 'count' },
    selected: false,
  },
  {
    id: 'i3',
    name: 'Bread',
    imageUrl: null,
    displayUnit: { id: 'u3', name: 'count' },
    selected: false,
  },
];

jest.mock('#/utils/connectionUtils', () => ({
  extractNodes: jest.fn(
    (c?: { edges?: Array<{ node: unknown }> | null } | null) =>
      c?.edges?.map(e => e.node) || [],
  ),
}));
jest.mock('#features/pantry/cache/items', () => ({
  removeFromPantryItemsCache: jest.fn(),
}));
jest.mock('#features/onboarding/hooks/useSelectableItems', () => ({
  useSelectableItems: jest.fn(
    ({
      initialItems,
    }: {
      initialItems?: Array<{ id: string; selected: boolean }>;
    }) => ({
      items: initialItems || [],
      selectedItems: [],
      toggleItem: jest.fn(),
      isMaxReached: false,
    }),
  ),
}));
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#/services/errorService');
jest.mock('#/utils/finallyHelpers');

jest.mock('#features/onboarding/components/OnBoardingWrapper', () => ({
  OnBoardingWrapper: ({
    title,
    subtitle,
    children,
    testID,
  }: {
    title?: string;
    subtitle?: string;
    children?: React.ReactNode;
    testID?: string;
  }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={testID || 'onboarding-wrapper'}>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
        {children}
      </View>
    );
  },
}));
jest.mock('#components/atoms/Button', () => ({
  Button: ({
    title,
    children,
    onPress,
    disabled,
  }: {
    title?: string;
    children?: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
  }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onPress} disabled={disabled} testID="action-button">
        <Text>{title || children}</Text>
      </Pressable>
    );
  },
}));
jest.mock('#components/atoms/AnimatedChip', () => ({
  AnimatedChip: ({
    label,
    selected,
  }: {
    label?: string;
    selected?: boolean;
  }) => {
    const { Text } = require('react-native');
    return (
      <Text>
        {label}
        {selected ? ' (selected)' : ''}
      </Text>
    );
  },
}));
jest.mock('#components/atoms/SousChefLoader', () => ({
  SousChefLoader: () => {
    const { Text } = require('react-native');
    return <Text>Loading...</Text>;
  },
}));

// Schema-driven mocks. The screen runs two queries:
//  - GetOnboardingItems (lists items, drives the chip set)
//  - GetPantry (selectedPantryId is 'p1', so this fires; returns no items)
// We mock both via the Query resolver. The Pantry resolver returns empty
// itemsConnection so the screen's "existing items" Set is empty.
const onboardingMocks = {
  Query: () => ({
    items: {
      totalCount: mockItems.length,
      edges: mockItems.map((node, i) => ({
        cursor: `c${i}`,
        node: {
          id: node.id,
          name: node.name,
          imageUrl: node.imageUrl,
          storageState: 'AMBIENT',
          displayUnit: node.displayUnit,
        },
      })),
      pageInfo: { hasNextPage: false, endCursor: null },
    },
    pantry: {
      id: 'p1',
      itemsConnection: {
        totalCount: 0,
        edges: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  }),
  PantryItemConnection: () => ({
    totalCount: 0,
    edges: [],
    pageInfo: { hasNextPage: false, endCursor: null },
  }),
  Pantry: () => ({
    itemsConnection: {
      totalCount: 0,
      edges: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  }),
};

describe('SelectPantryItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', async () => {
    renderWithApollo(<SelectPantryItems />, { mocks: onboardingMocks });
    expect(await screen.findByText('Stock your pantry')).toBeTruthy();
  });

  it('shows subtitle', async () => {
    renderWithApollo(<SelectPantryItems />, { mocks: onboardingMocks });
    expect(
      await screen.findByText(/Select items you already have at home/),
    ).toBeTruthy();
  });

  it('renders item chips', async () => {
    renderWithApollo(<SelectPantryItems />, { mocks: onboardingMocks });
    expect(await screen.findByText('Eggs')).toBeTruthy();
    expect(await screen.findByText('Milk')).toBeTruthy();
    expect(await screen.findByText('Bread')).toBeTruthy();
  });

  /**
   * The gate is `(loading && !data) || (pantryLoading && !pantryData)`, not the
   * two flags alone. Under `cache-and-network` Apollo reports `loading: true`
   * for the whole network leg on EVERY mount — `nextFetchPolicy` lives on the
   * ObservableQuery and useQuery builds a new one each time — so stepping back
   * into this onboarding step re-showed the loader over a warm cache, for as
   * long as the request took.
   */
  it('renders the cached items on a remount, without the loader', async () => {
    const cache = makeCache();

    const first = renderWithApollo(<SelectPantryItems />, {
      mocks: onboardingMocks,
      cache,
    });
    expect(await screen.findByText('Eggs')).toBeTruthy();
    first.unmount();

    // Same cache — stepping back into this screen.
    renderWithApollo(<SelectPantryItems />, { mocks: onboardingMocks, cache });

    expect(screen.getByText('Eggs')).toBeTruthy();
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  it('shows selected count', async () => {
    renderWithApollo(<SelectPantryItems />, { mocks: onboardingMocks });
    expect(await screen.findByText('0 selected')).toBeTruthy();
  });

  it('shows add items button', async () => {
    renderWithApollo(<SelectPantryItems />, { mocks: onboardingMocks });
    expect(await screen.findByText('Add Items')).toBeTruthy();
  });

  it('shows error state when query fails', async () => {
    // Make GetOnboardingItems throw to force the error branch
    const errorMocks = {
      Query: () => ({
        items: () => {
          throw new Error('Network error');
        },
        pantry: {
          id: 'p1',
          itemsConnection: {
            totalCount: 0,
            edges: [],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      }),
    };
    renderWithApollo(<SelectPantryItems />, { mocks: errorMocks });
    expect(
      await screen.findByText('Unable to load items. Please try again.'),
    ).toBeTruthy();
    expect(screen.getByText('Try Again')).toBeTruthy();
  });

  it('renders the testID', async () => {
    renderWithApollo(<SelectPantryItems />, { mocks: onboardingMocks });
    expect(
      await screen.findByTestId('onboarding-select-pantry-items-screen'),
    ).toBeTruthy();
  });

  it('treats a DuplicatePantryItemError on the bulk add as a per-item skip', async () => {
    // The list is pre-filtered against existing catalog ids, but a race
    // (another device adding the same item) can still return the duplicate
    // member. The item is already in the pantry — the onboarding goal — so
    // the flow must proceed without surfacing an error.
    const { useSelectableItems } = jest.requireMock(
      '#features/onboarding/hooks/useSelectableItems',
    );
    useSelectableItems.mockReturnValue({
      items: mockItems,
      selectedItems: [mockItems[0]],
      toggleItem: jest.fn(),
      isMaxReached: false,
    });

    renderWithApollo(<SelectPantryItems />, {
      mocks: {
        ...onboardingMocks,
        Mutation: () => ({
          createPantryItem: {
            __typename: 'DuplicatePantryItemError',
            message: 'Item already exists in this pantry',
            code: 'PANTRY_ITEM_ALREADY_EXISTS',
            existingPantryItemIds: ['existing-1'],
          },
        }),
      },
    });

    fireEvent.press(await screen.findByTestId('action-button'));

    await waitFor(() => {
      expect(mockNavigateToNextStep).toHaveBeenCalledWith('SelectPantryItems');
    });
    const { errorService } = jest.requireMock('#/services/errorService');
    expect(errorService.reportError).not.toHaveBeenCalled();
  });
});
