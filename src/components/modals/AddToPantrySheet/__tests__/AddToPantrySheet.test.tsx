'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { AddToPantrySheet } from '../AddToPantrySheet';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#features/pantry/hooks/usePantryItemSuggestions', () => ({
  usePantryItemSuggestions: jest.fn(() => ({
    grouped: [],
    loading: false,
    hasSuggestions: false,
    refetch: jest.fn(),
  })),
}));

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useCreatePantryItemMutation: jest.fn(() => [jest.fn(), { loading: false }]),
  useRestockPantryItemMutation: jest.fn(() => [jest.fn(), { loading: false }]),
}));

jest.mock('#/utils/connectionUtils', () => ({
  normalizePantry: jest.fn(() => ({ storageLocations: [] })),
}));

jest.mock('#/utils/errors/pantryItemDuplicate', () => ({
  isPantryItemDuplicateError: jest.fn(() => false),
  getPantryItemDuplicateInfo: jest.fn(() => null),
}));

jest.mock('#hooks/home/pantry/utils', () => ({
  addToPantryItemsCache: jest.fn(),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/services/toastService', () => ({
  toastService: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('../../AddItemSheet/AddItemSheet', () => ({
  AddItemSheet: ({ children }: any) => {
    const { View, Text } = require('react-native');
    return require('react').createElement(
      View,
      { testID: 'add-item-sheet' },
      require('react').createElement(Text, null, 'AddItemSheet'),
      children,
    );
  },
}));

jest.mock('../../AddItemSheet/useAddItemSheetState', () => ({
  useAddItemSheetState: jest.fn(() => ({
    exitingItems: new Set(),
    shouldFetch: true,
    startExitAnimation: jest.fn(),
    completeExitAnimation: jest.fn(),
  })),
}));

jest.mock('../../AddItemSheet/configs/pantryConfig', () => ({
  pantrySheetConfig: {
    deferFetch: false,
    quickAdd: { toastMessage: (name: string) => `Added ${name}` },
  },
}));

jest.mock('../AddDetailsSheet', () => ({
  AddDetailsSheet: () => null,
}));

jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({
    readQuery: jest.fn(() => null),
    cache: { updateQuery: jest.fn() },
  }),
}));

describe('AddToPantrySheet', () => {
  const defaultProps = {
    visible: true,
    pantryId: 'pantry-1',
    onClose: jest.fn(),
    onItemAdded: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders AddItemSheet when visible', () => {
    render(<AddToPantrySheet {...defaultProps} />);
    expect(screen.getByTestId('add-item-sheet')).toBeTruthy();
  });

  it('renders without crashing when pantryId is undefined', () => {
    render(<AddToPantrySheet {...defaultProps} pantryId={undefined} />);
    expect(screen.getByText('AddItemSheet')).toBeTruthy();
  });

  it('renders when not visible', () => {
    render(<AddToPantrySheet {...defaultProps} visible={false} />);
    expect(screen.getByText('AddItemSheet')).toBeTruthy();
  });

  it('renders without onItemAdded callback', () => {
    render(<AddToPantrySheet {...defaultProps} onItemAdded={undefined} />);
    expect(screen.getByText('AddItemSheet')).toBeTruthy();
  });

  it('renders with suggestions available', () => {
    const { usePantryItemSuggestions } = jest.requireMock(
      '#features/pantry/hooks/usePantryItemSuggestions',
    );
    usePantryItemSuggestions.mockReturnValue({
      grouped: [{ title: 'Recent', items: [{ id: '1', name: 'Milk' }] }],
      loading: false,
      hasSuggestions: true,
      refetch: jest.fn(),
    });

    render(<AddToPantrySheet {...defaultProps} />);
    expect(screen.getByTestId('add-item-sheet')).toBeTruthy();
  });

  it('renders with suggestions loading', () => {
    const { usePantryItemSuggestions } = jest.requireMock(
      '#features/pantry/hooks/usePantryItemSuggestions',
    );
    usePantryItemSuggestions.mockReturnValue({
      grouped: [],
      loading: true,
      hasSuggestions: false,
      refetch: jest.fn(),
    });

    render(<AddToPantrySheet {...defaultProps} />);
    expect(screen.getByTestId('add-item-sheet')).toBeTruthy();
  });

  it('renders with create mutation loading', () => {
    const { useCreatePantryItemMutation } = jest.requireMock('#generated');
    useCreatePantryItemMutation.mockReturnValue([jest.fn(), { loading: true }]);

    render(<AddToPantrySheet {...defaultProps} />);
    expect(screen.getByTestId('add-item-sheet')).toBeTruthy();

    // Restore
    useCreatePantryItemMutation.mockReturnValue([
      jest.fn(),
      { loading: false },
    ]);
  });

  it('renders with restock mutation loading', () => {
    const { useRestockPantryItemMutation } = jest.requireMock('#generated');
    useRestockPantryItemMutation.mockReturnValue([
      jest.fn(),
      { loading: true },
    ]);

    render(<AddToPantrySheet {...defaultProps} />);
    expect(screen.getByTestId('add-item-sheet')).toBeTruthy();

    // Restore
    useRestockPantryItemMutation.mockReturnValue([
      jest.fn(),
      { loading: false },
    ]);
  });

  it('renders with different pantryId', () => {
    render(<AddToPantrySheet {...defaultProps} pantryId="pantry-2" />);
    expect(screen.getByTestId('add-item-sheet')).toBeTruthy();
  });
});
