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
  const mockState = {
    user: { id: 'u1' },
    selectedHomeId: 'h1',
    setSelectedShoppingListId: jest.fn(),
  };
  const fn = (selector: any) => selector(mockState);
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return {
    useAppStore: fn,
    useUser: jest.fn(() => mockState.user),
    useSelectedHomeId: jest.fn(() => mockState.selectedHomeId),
  };
});

let mockListsData: any = { shoppingLists: { edges: [] } };
let mockListsLoading = false;

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useMutation: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'CreateShoppingList') return [jest.fn(), { loading: false }];
    return [jest.fn(), {}];
  }),
  useQuery: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'GetShoppingListsLite') {
      return {
        data: mockListsData,
        loading: mockListsLoading,
        error: undefined,
        refetch: jest.fn(),
      };
    }
    return { data: undefined, loading: false, error: undefined };
  }),
}));

jest.mock('#/utils/connectionUtils', () => ({
  extractNodes: jest.fn(c => c?.edges?.map((e: any) => e.node) || []),
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
jest.mock('#components/base/Button', () => ({
  Button: ({ title, onPress, disabled }: any) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onPress} disabled={disabled} testID="action-button">
        <Text>{title}</Text>
      </Pressable>
    );
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
        edges: [
          { node: { id: 'sl1', name: 'Weekly Groceries', isDefault: true } },
        ],
      },
    };
    render(<CreateShoppingListScreen />);
    expect(screen.getByText("You're all set!")).toBeTruthy();
    expect(screen.getByText('Weekly Groceries')).toBeTruthy();
  });

  it('shows continue button when list exists', () => {
    mockListsData = {
      shoppingLists: {
        edges: [
          { node: { id: 'sl1', name: 'Weekly Groceries', isDefault: true } },
        ],
      },
    };
    render(<CreateShoppingListScreen />);
    expect(screen.getByText('Continue')).toBeTruthy();
  });
});
