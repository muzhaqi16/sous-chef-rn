'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
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
  return { useAppStore: fn };
});

const mockItems = [
  {
    id: 'i1',
    name: 'Eggs',
    imageUrl: null,
    displayUnit: { id: 'u1' },
    selected: false,
  },
  {
    id: 'i2',
    name: 'Milk',
    imageUrl: null,
    displayUnit: { id: 'u2' },
    selected: false,
  },
  {
    id: 'i3',
    name: 'Bread',
    imageUrl: null,
    displayUnit: { id: 'u3' },
    selected: false,
  },
];

let mockLoading = false;
let mockQueryError: any = null;

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useQuery: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'GetOnboardingItems') {
      return {
        data: {
          items: {
            edges: mockItems.map(item => ({ node: item })),
          },
        },
        loading: mockLoading,
        error: mockQueryError,
        refetch: jest.fn(),
      };
    }
    if (opName === 'GetPantry') {
      return {
        data: { pantry: { itemsConnection: { edges: [] } } },
        loading: false,
        error: undefined,
      };
    }
    return { data: undefined, loading: false, error: undefined };
  }),
  useMutation: jest.fn(() => [jest.fn(), { loading: false }]),
}));

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

describe('SelectPantryItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoading = false;
    mockQueryError = null;
  });

  it('renders the title', () => {
    render(<SelectPantryItems />);
    expect(screen.getByText('Stock your pantry')).toBeTruthy();
  });

  it('shows subtitle', () => {
    render(<SelectPantryItems />);
    expect(
      screen.getByText(/Select items you already have at home/),
    ).toBeTruthy();
  });

  it('renders item chips', () => {
    render(<SelectPantryItems />);
    expect(screen.getByText('Eggs')).toBeTruthy();
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('Bread')).toBeTruthy();
  });

  it('shows selected count', () => {
    render(<SelectPantryItems />);
    expect(screen.getByText('0 selected')).toBeTruthy();
  });

  it('shows add items button', () => {
    render(<SelectPantryItems />);
    expect(screen.getByText('Add Items')).toBeTruthy();
  });

  it('shows error state when query fails', () => {
    mockQueryError = { message: 'Network error' };
    render(<SelectPantryItems />);
    expect(
      screen.getByText('Unable to load items. Please try again.'),
    ).toBeTruthy();
    expect(screen.getByText('Try Again')).toBeTruthy();
  });

  it('renders the testID', () => {
    render(<SelectPantryItems />);
    expect(
      screen.getByTestId('onboarding-select-pantry-items-screen'),
    ).toBeTruthy();
  });
});
