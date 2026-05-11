'use no memo';

import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { SelectPantryItems } from '../SelectPantryItems';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockNavigateToNextStep = jest.fn();
const mockNavigateToPreviousStep = jest.fn();
jest.mock('#hooks/navigation/useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
    navigateToPreviousStep: mockNavigateToPreviousStep,
  }),
}));

jest.mock('#store/useAppStore', () => {
  const fn = (selector: any) => selector({ selectedPantryId: 'p1' });
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
  extractNodes: jest.fn(c => c?.edges?.map((e: any) => e.node) || []),
}));
jest.mock('#/hooks/home/pantry/utils', () => ({
  removeFromPantryItemsCache: jest.fn(),
}));
jest.mock('#hooks/useSelectableItems', () => ({
  useSelectableItems: jest.fn(({ initialItems }: any) => ({
    items: initialItems || [],
    selectedItems: [],
    toggleItem: jest.fn(),
    isMaxReached: false,
  })),
}));
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
}));
jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#components/templates/OnBoardingWrapper', () => ({
  OnBoardingWrapper: ({ title, subtitle, children, testID }: any) => {
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
jest.mock('#components/base/Button', () => ({
  Button: ({ title, children, onPress, disabled }: any) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onPress} disabled={disabled} testID="action-button">
        <Text>{title || children}</Text>
      </Pressable>
    );
  },
}));
jest.mock('#components/atoms/AnimatedChip', () => ({
  AnimatedChip: ({ label, selected }: any) => {
    const { Text } = require('react-native');
    return (
      <Text>
        {label}
        {selected ? ' (selected)' : ''}
      </Text>
    );
  },
}));
jest.mock('#/components/base/SousChefLoader', () => ({
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
});
