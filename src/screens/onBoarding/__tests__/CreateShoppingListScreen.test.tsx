'use no memo';

import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import type { RootState } from '#store/index';
import type { User } from '#store/slices/authSlice';
import { CreateShoppingListScreen } from '../CreateShoppingListScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockNavigateToNextStep = jest.fn();
const mockSkipToStep = jest.fn();
jest.mock('#hooks/navigation/useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
    skipToStep: mockSkipToStep,
  }),
}));

jest.mock('#store/useAppStore', () => {
  const mockState: Partial<RootState> = {
    user: { id: 'u1' } as Partial<User> as User,
    selectedHomeId: 'h1',
    setSelectedShoppingListId: jest.fn(),
  };
  const fn = <T,>(selector: (state: RootState) => T): T =>
    selector(mockState as RootState);
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return {
    useAppStore: fn,
    useUser: jest.fn(() => mockState.user),
    useSelectedHomeId: jest.fn(() => mockState.selectedHomeId),
  };
});

jest.mock('#/utils/connectionUtils', () => ({
  extractNodes: jest.fn(
    (c?: { edges?: Array<{ node: unknown }> }) =>
      c?.edges?.map(e => e.node) || [],
  ),
}));
jest.mock('#utils/validation/onboarding', () => ({
  createShoppingListSchema: {
    fields: {},
    validate: jest.fn(),
    isValid: jest.fn(() => Promise.resolve(true)),
  },
}));
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#/services/errorService');
jest.mock('#/utils/finallyHelpers');

jest.mock('#components/templates/OnBoardingWrapper', () => ({
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
jest.mock('#components/molecules/DynamicFormFields', () => ({
  DynamicFormFields: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="form-fields">
        <Text>Shopping List Name</Text>
      </View>
    );
  },
}));
jest.mock('#components/atoms/BaseInput/BaseInput', () => ({
  BaseInput: () => null,
}));
jest.mock('#components/atoms/Button', () => ({
  Button: ({
    title,
    onPress,
    disabled,
  }: {
    title?: string;
    onPress: () => void;
    disabled?: boolean;
  }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onPress} disabled={disabled} testID="action-button">
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));
jest.mock('#components/atoms/SousChefLoader', () => ({
  SousChefLoader: () => {
    const { Text } = require('react-native');
    return <Text>Loading...</Text>;
  },
}));

// Schema-driven mock helpers — return shopping lists shape (with or without
// existing list) so the screen exits its "checking existing" state.
const noExistingList = {
  Query: () => ({
    shoppingLists: {
      totalCount: 0,
      edges: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  }),
};

const oneExistingList = {
  Query: () => ({
    shoppingLists: {
      totalCount: 1,
      edges: [
        {
          cursor: 'c1',
          node: {
            id: 'sl1',
            name: 'Weekly Groceries',
            isDefault: true,
            totalItems: 0,
            completedItems: 0,
            homeId: null,
            home: null,
            ownerships: [],
          },
        },
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  }),
};

describe('CreateShoppingListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders create form when no existing list', async () => {
    renderWithApollo(<CreateShoppingListScreen />, { mocks: noExistingList });
    expect(await screen.findByText('Create your shopping list')).toBeTruthy();
  });

  it('shows form fields for list creation', async () => {
    renderWithApollo(<CreateShoppingListScreen />, { mocks: noExistingList });
    expect(await screen.findByTestId('form-fields')).toBeTruthy();
  });

  it('shows create list button', async () => {
    renderWithApollo(<CreateShoppingListScreen />, { mocks: noExistingList });
    expect(await screen.findByText('Create List')).toBeTruthy();
  });

  it('shows subtitle', async () => {
    renderWithApollo(<CreateShoppingListScreen />, { mocks: noExistingList });
    expect(
      await screen.findByText('You can add items to it later'),
    ).toBeTruthy();
  });

  it('shows existing list view when list exists', async () => {
    renderWithApollo(<CreateShoppingListScreen />, { mocks: oneExistingList });
    expect(await screen.findByText("You're all set!")).toBeTruthy();
    expect(await screen.findByText('Weekly Groceries')).toBeTruthy();
  });

  it('shows continue button when list exists', async () => {
    renderWithApollo(<CreateShoppingListScreen />, { mocks: oneExistingList });
    expect(await screen.findByText('Continue')).toBeTruthy();
  });
});
