'use no memo';
import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { AddToPantrySheet } from '../AddToPantrySheet';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#features/pantry/hooks/usePantryItemSuggestions', () => ({
  PANTRY_SUGGESTIONS_LIMIT: 20,
  usePantryItemSuggestions: jest.fn(() => ({
    grouped: [],
    loading: false,
    hasSuggestions: false,
    refetch: jest.fn(),
  })),
}));

jest.mock('#/utils/connectionUtils', () => ({
  extractNodes: jest.fn(() => []),
}));

jest.mock('#/utils/errors/pantryItemDuplicate', () => {
  const isDup = jest.fn().mockReturnValue(false);
  const getInfo = jest.fn().mockReturnValue(null);
  const getInfoFromPayload = jest.fn().mockReturnValue(null);
  return {
    isPantryItemDuplicateError: isDup,
    getPantryItemDuplicateInfo: getInfo,
    getPantryItemDuplicateInfoFromPayload: getInfoFromPayload,
    promptPantryDuplicate: jest.fn(),
    getPantryItemDuplicateFromResult: jest.fn(
      (payload: { __typename?: string } | null | undefined, error: unknown) => {
        if (payload?.__typename === 'DuplicatePantryItemError') {
          const info = getInfoFromPayload(payload);
          if (info) return info;
        }
        if (error != null && isDup(error)) return getInfo(error);
        return null;
      },
    ),
  };
});

jest.mock('#hooks/home/pantry/utils', () => ({
  addToPantryItemsCache: jest.fn(),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/services/toastService', () => ({
  toastService: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('../../AddItemSheet/AddItemSheet', () => ({
  AddItemSheet: ({ children }: { children: React.ReactNode }) => {
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
    renderWithApollo(<AddToPantrySheet {...defaultProps} />);
    expect(screen.getByTestId('add-item-sheet')).toBeTruthy();
  });

  it('renders without crashing when pantryId is undefined', () => {
    renderWithApollo(
      <AddToPantrySheet {...defaultProps} pantryId={undefined} />,
    );
    expect(screen.getByText('AddItemSheet')).toBeTruthy();
  });

  it('renders when not visible', () => {
    renderWithApollo(<AddToPantrySheet {...defaultProps} visible={false} />);
    expect(screen.getByText('AddItemSheet')).toBeTruthy();
  });

  it('renders without onItemAdded callback', () => {
    renderWithApollo(
      <AddToPantrySheet {...defaultProps} onItemAdded={undefined} />,
    );
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

    renderWithApollo(<AddToPantrySheet {...defaultProps} />);
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

    renderWithApollo(<AddToPantrySheet {...defaultProps} />);
    expect(screen.getByTestId('add-item-sheet')).toBeTruthy();
  });

  it('renders with different pantryId', () => {
    renderWithApollo(
      <AddToPantrySheet {...defaultProps} pantryId="pantry-2" />,
    );
    expect(screen.getByTestId('add-item-sheet')).toBeTruthy();
  });
});
