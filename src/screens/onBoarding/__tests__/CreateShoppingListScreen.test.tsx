'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
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
  const selectUser = (s: any) => s.user;
  const selectSelectedHomeId = (s: any) => s.selectedHomeId;
  const fn = (selector: any) => selector({
    user: { id: 'u1' },
    selectedHomeId: 'h1',
    setSelectedShoppingListId: jest.fn(),
  });
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return { useAppStore: fn, selectUser, selectSelectedHomeId };
});

let mockListsData: any = { shoppingLists: { edges: [] } };
let mockListsLoading = false;

jest.mock('#generated', () => ({
  useCreateShoppingListMutation: jest.fn(() => [jest.fn(), { loading: false }]),
  useGetShoppingListsLiteQuery: jest.fn(() => ({
    data: mockListsData,
    loading: mockListsLoading,
  })),
}));

jest.mock('#/utils/connectionUtils', () => ({
  extractNodes: jest.fn((c) => c?.edges?.map((e: any) => e.node) || []),
}));
jest.mock('#utils/validation/onboarding', () => ({
  createShoppingListSchema: {
    fields: {},
    validate: jest.fn(),
    isValid: jest.fn(() => Promise.resolve(true)),
  },
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
jest.mock('#components/molecules/DynamicFormFields', () => ({
  DynamicFormFields: () => {
    const { View, Text } = require('react-native');
    return <View testID="form-fields"><Text>Shopping List Name</Text></View>;
  },
}));
jest.mock('#components/atoms/BaseInput/BaseInput', () => ({
  BaseInput: () => null,
}));
jest.mock('#components/base/Button', () => ({
  Button: ({ title, onPress, disabled }: any) => {
    const { Pressable, Text } = require('react-native');
    return <Pressable onPress={onPress} disabled={disabled} testID="action-button"><Text>{title}</Text></Pressable>;
  },
}));
jest.mock('#/components/base/SousChefLoader', () => ({
  SousChefLoader: () => {
    const { Text } = require('react-native');
    return <Text>Loading...</Text>;
  },
}));

describe('CreateShoppingListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListsData = { shoppingLists: { edges: [] } };
    mockListsLoading = false;
  });

  it('renders create form when no existing list', () => {
    render(<CreateShoppingListScreen />);
    expect(screen.getByText('Create your shopping list')).toBeTruthy();
  });

  it('shows form fields for list creation', () => {
    render(<CreateShoppingListScreen />);
    expect(screen.getByTestId('form-fields')).toBeTruthy();
  });

  it('shows create list button', () => {
    render(<CreateShoppingListScreen />);
    expect(screen.getByText('Create List')).toBeTruthy();
  });

  it('shows subtitle', () => {
    render(<CreateShoppingListScreen />);
    expect(screen.getByText('You can add items to it later')).toBeTruthy();
  });

  it('shows existing list view when list exists', () => {
    mockListsData = {
      shoppingLists: {
        edges: [{ node: { id: 'sl1', name: 'Weekly Groceries', isDefault: true } }],
      },
    };
    render(<CreateShoppingListScreen />);
    expect(screen.getByText("You're all set!")).toBeTruthy();
    expect(screen.getByText('Weekly Groceries')).toBeTruthy();
  });

  it('shows continue button when list exists', () => {
    mockListsData = {
      shoppingLists: {
        edges: [{ node: { id: 'sl1', name: 'Weekly Groceries', isDefault: true } }],
      },
    };
    render(<CreateShoppingListScreen />);
    expect(screen.getByText('Continue')).toBeTruthy();
  });
});
