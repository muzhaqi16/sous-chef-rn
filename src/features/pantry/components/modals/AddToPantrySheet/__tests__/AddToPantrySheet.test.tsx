'use no memo';
import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import {
  renderWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
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

jest.mock('#/apollo/utils/pantryCacheUpdaters', () => ({
  addToPantryItemsCache: jest.fn(),
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#/services/toastService', () => ({
  toastService: { success: jest.fn(), error: jest.fn() },
}));

/**
 * The quick-add handlers are props on `AddItemSheet`, which is mocked away —
 * so the mock parks them here for a test to call. Without this the handlers
 * are unreachable and only the render path is covered.
 */
const sheetProps: { current: Record<string, unknown> } = { current: {} };

jest.mock('#features/catalog/ui/AddItemSheet/AddItemSheet', () => ({
  AddItemSheet: ({
    children,
    ...rest
  }: {
    children: React.ReactNode;
  } & Record<string, unknown>) => {
    const { View, Text } = require('react-native');
    sheetProps.current = rest;
    return require('react').createElement(
      View,
      { testID: 'add-item-sheet' },
      require('react').createElement(Text, null, 'AddItemSheet'),
      children,
    );
  },
}));

jest.mock('#features/catalog/ui/AddItemSheet/useAddItemSheetState', () => ({
  useAddItemSheetState: jest.fn(() => ({
    exitingItems: new Set(),
    shouldFetch: true,
    startExitAnimation: jest.fn(),
    completeExitAnimation: jest.fn(),
  })),
}));

jest.mock(
  '#features/pantry/components/modals/AddToPantrySheet/pantrySheetConfig',
  () => ({
    pantrySheetConfig: {
      deferFetch: false,
      quickAdd: { toastMessageKey: 'addItemSheet.added' },
    },
  }),
);

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

  /**
   * Every business failure of `createPantryItem` is a member of the result
   * union, and under `errorPolicy: 'all'` it RESOLVES — `{ data, error:
   * undefined }`. Reading `result.error` alone counts a refusal as success:
   * the success toast stands, `onItemAdded` fires, and the optimistic row stays
   * in the pantry pointing at an id the server never created. Quick-add has to
   * read the union member.
   */
  describe('a resolved refusal is not a success', () => {
    const forbidden: MockedResponse = {
      request: {
        query: CreatePantryItemDocument,
        // The input carries a freshly minted cuid, so match on the operation.
        variables: () => true,
      },
      result: {
        data: {
          createPantryItem: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'No add-items access',
          },
        },
      },
    };

    it('reports a ForbiddenError instead of calling onItemAdded', async () => {
      const onItemAdded = jest.fn();
      renderWithApollo(
        <AddToPantrySheet {...defaultProps} onItemAdded={onItemAdded} />,
        { operationMocks: [forbidden] },
      );

      const quickAdd = sheetProps.current.onQuickAddSearchSuggestion as (
        item: unknown,
      ) => void;
      quickAdd({ id: 'item-1', name: 'Milk' });

      await waitFor(() =>
        expect(toastService.error).toHaveBeenCalledWith(
          'Failed to add item. Please try again.',
        ),
      );
      expect(onItemAdded).not.toHaveBeenCalled();
    });
  });
});
