'use no memo';
import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import {
  renderWithApollo,
  recordMock,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
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

jest.mock('#domain/pantryItemDuplicate', () => {
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

  /**
   * The server REFUSES a duplicate add — it never merges — so quick-add withdraws
   * the row it published and restocks the existing one instead. Withdrawing the
   * row is not enough: the optimistic add also moved `Pantry.stats.totalItems`,
   * which the header and the "All" tab badge both read, and which does not
   * self-heal the way a dangling connection edge does. Evicting the entity alone
   * leaves the count one too high per refused add until a pull-to-refresh.
   */
  describe('a duplicate refusal leaves the header count where it started', () => {
    const SEED_PANTRY = gql`
      query SeedPantry($id: ID!) {
        pantry(id: $id) {
          __typename
          id
          stats {
            __typename
            totalItems
          }
          itemsConnection {
            __typename
            totalCount
            edges {
              __typename
              cursor
              node {
                __typename
                id
              }
            }
          }
        }
      }
    `;

    const seedCache = () => {
      const cache = makeCache();
      cache.writeQuery({
        query: SEED_PANTRY,
        variables: { id: 'pantry-1' },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'pantry-1',
            stats: { __typename: 'PantryStats', totalItems: 70 },
            itemsConnection: {
              __typename: 'PantryItemConnection',
              totalCount: 70,
              edges: [
                {
                  __typename: 'PantryItemEdge',
                  cursor: 'pi-1',
                  node: { __typename: 'PantryItem', id: 'pi-1' },
                },
              ],
            },
          },
        },
      });
      return cache;
    };

    const readTotals = (cache: ReturnType<typeof makeCache>) => {
      const read = cache.readQuery<{
        pantry: {
          stats: { totalItems: number };
          itemsConnection: { totalCount: number };
        };
      }>({ query: SEED_PANTRY, variables: { id: 'pantry-1' } });
      return {
        totalItems: read?.pantry?.stats?.totalItems,
        totalCount: read?.pantry?.itemsConnection?.totalCount,
      };
    };

    const duplicate: MockedResponse = {
      request: {
        query: CreatePantryItemDocument,
        variables: () => true,
      },
      result: {
        data: {
          createPantryItem: {
            __typename: 'DuplicatePantryItemError',
            code: ErrorCode.Conflict,
            existingPantryItemIds: ['pi-1'],
          },
        },
      },
    };

    const restocked: MockedResponse = {
      request: {
        query: RestockPantryItemDocument,
        variables: () => true,
      },
      result: {
        data: {
          restockPantryItem: {
            __typename: 'RestockPantryItemPayload',
            pantryItemUsage: {
              __typename: 'PantryItemUsage',
              id: 'usage-1',
              pantryItem: { __typename: 'PantryItem', id: 'pi-1' },
            },
          },
        },
      },
    };

    beforeEach(() => {
      const { getPantryItemDuplicateInfoFromPayload } = jest.requireMock(
        '#domain/pantryItemDuplicate',
      );
      getPantryItemDuplicateInfoFromPayload.mockReturnValue({
        existingPantryItemId: 'pi-1',
        existingPantryItemIds: ['pi-1'],
      });
    });

    it('reverses both counters the optimistic add moved', async () => {
      const cache = seedCache();
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache,
        operationMocks: [duplicate, restocked],
      });

      const quickAdd = sheetProps.current.onQuickAddSearchSuggestion as (
        item: unknown,
      ) => void;
      quickAdd({ id: 'item-1', name: 'Milk' });

      // The optimistic write lands synchronously, before the refusal arrives.
      expect(readTotals(cache)).toEqual({ totalItems: 71, totalCount: 71 });

      await waitFor(() =>
        expect(readTotals(cache)).toEqual({ totalItems: 70, totalCount: 70 }),
      );
    });

    it('corrects the eager "added" toast to say it restocked instead', async () => {
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache: seedCache(),
        operationMocks: [duplicate, restocked],
      });

      const quickAdd = sheetProps.current.onQuickAddSearchSuggestion as (
        item: unknown,
      ) => void;
      quickAdd({ id: 'item-1', name: 'Milk' });

      await waitFor(() =>
        expect(toastService.success).toHaveBeenCalledWith('Restocked Milk'),
      );
    });
  });

  /**
   * Offline-first: the pantry decides "do I already stock this?" from its own
   * cache. Offline the server is never asked, and on the replay path its refusal
   * arrives with the existing ids stripped in production — so a create fired
   * against a row we can already see is a create that can only be undone later.
   */
  describe('a duplicate the cache can already see never becomes a create', () => {
    // The args are load-bearing: `itemsConnection` is keyed on them, so a seed
    // without them writes a store key the app never produces and the reader
    // silently matches nothing.
    const STOCKED_PANTRY = gql`
      query SeedStockedPantry(
        $id: ID!
        $itemsFirst: Int
        $itemsFilter: PantryItemFilters
        $itemsOrderBy: PantryItemOrderBy
      ) {
        pantry(id: $id) {
          __typename
          id
          stats {
            __typename
            totalItems
          }
          itemsConnection(
            first: $itemsFirst
            filters: $itemsFilter
            orderBy: $itemsOrderBy
          ) {
            __typename
            totalCount
            edges {
              __typename
              cursor
              node {
                __typename
                id
                itemName
                quantity
                item {
                  __typename
                  id
                }
              }
            }
          }
        }
      }
    `;

    const QUANTITY = gql`
      fragment StockedQuantity on PantryItem {
        quantity
      }
    `;

    const seedStocked = (edges: unknown[]) => {
      const cache = makeCache();
      cache.writeQuery({
        query: STOCKED_PANTRY,
        variables: {
          id: 'pantry-1',
          itemsFirst: 100,
          itemsFilter: undefined,
          itemsOrderBy: undefined,
        },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'pantry-1',
            stats: { __typename: 'PantryStats', totalItems: edges.length },
            itemsConnection: {
              __typename: 'PantryItemConnection',
              totalCount: edges.length,
              edges,
            },
          },
        },
      });
      return cache;
    };

    const stockedEdge = {
      __typename: 'PantryItemEdge',
      cursor: 'pi-1',
      node: {
        __typename: 'PantryItem',
        id: 'pi-1',
        itemName: 'Milk',
        quantity: 3,
        item: { __typename: 'Item', id: 'item-1' },
      },
    };

    const restocked: MockedResponse = {
      request: { query: RestockPantryItemDocument, variables: () => true },
      result: {
        data: {
          restockPantryItem: {
            __typename: 'RestockPantryItemPayload',
            pantryItemUsage: {
              __typename: 'PantryItemUsage',
              id: 'usage-1',
              pantryItem: { __typename: 'PantryItem', id: 'pi-1' },
            },
          },
        },
      },
    };

    const readQuantity = (cache: ReturnType<typeof makeCache>) =>
      cache.readFragment<{ quantity: number }>({
        id: 'PantryItem:pi-1',
        fragment: QUANTITY,
      })?.quantity;

    it('restocks the row it can see instead of firing a create', async () => {
      const cache = seedStocked([stockedEdge]);
      const create = recordMock(CreatePantryItemDocument, {
        data: {
          createPantryItem: {
            __typename: 'CreatePantryItemPayload',
            pantryItem: { __typename: 'PantryItem', id: 'pi-new' },
          },
        },
      });
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache,
        operationMocks: [create.mock, restocked],
      });

      const quickAdd = sheetProps.current.onQuickAddSearchSuggestion as (
        item: unknown,
      ) => void;
      quickAdd({ id: 'item-1', name: 'Milk' });

      await waitFor(() =>
        expect(toastService.success).toHaveBeenCalledWith('Restocked Milk'),
      );
      // The point of the whole exercise: nothing was queued that the server would
      // only refuse, so there is nothing to undo on reconnect.
      expect(create.fired).toHaveLength(0);
      expect(toastService.error).not.toHaveBeenCalled();
      // Once, not twice — the generic "Added" toast must not fire alongside it.
      expect(toastService.success).toHaveBeenCalledTimes(1);
    });

    it('bumps the quantity locally, so the change shows before the server replies', () => {
      // Offline the restock's `update` never runs. Without the local write the
      // toast would claim a change the list does not show.
      const cache = seedStocked([stockedEdge]);
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache,
        operationMocks: [restocked],
      });

      const quickAdd = sheetProps.current.onQuickAddSearchSuggestion as (
        item: unknown,
      ) => void;
      quickAdd({ id: 'item-1', name: 'Milk' });

      expect(readQuantity(cache)).toBe(4);
    });

    it('leaves the count alone — a restock adds no row', async () => {
      const cache = seedStocked([stockedEdge]);
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache,
        operationMocks: [restocked],
      });

      const quickAdd = sheetProps.current.onQuickAddSearchSuggestion as (
        item: unknown,
      ) => void;
      quickAdd({ id: 'item-1', name: 'Milk' });

      await waitFor(() => expect(toastService.success).toHaveBeenCalled());
      const read = cache.readQuery<{
        pantry: { stats: { totalItems: number } };
      }>({
        query: STOCKED_PANTRY,
        variables: {
          id: 'pantry-1',
          itemsFirst: 100,
          itemsFilter: undefined,
          itemsOrderBy: undefined,
        },
      });
      expect(read?.pantry?.stats?.totalItems).toBe(1);
    });

    it('still fires the create for an item the cache does not stock', async () => {
      // The server refusal stays the backstop for what the cache cannot see — a
      // windowed list, or a collaborator's add. If this stops firing, the local
      // check has started swallowing real adds.
      const cache = seedStocked([stockedEdge]);
      const create = recordMock(CreatePantryItemDocument, {
        data: {
          createPantryItem: {
            __typename: 'CreatePantryItemPayload',
            pantryItem: { __typename: 'PantryItem', id: 'pi-new' },
          },
        },
      });
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache,
        operationMocks: [create.mock],
      });

      const quickAdd = sheetProps.current.onQuickAddSearchSuggestion as (
        item: unknown,
      ) => void;
      quickAdd({ id: 'item-other', name: 'Eggs' });

      await waitFor(() => expect(create.fired).toHaveLength(1));
    });
  });
});
