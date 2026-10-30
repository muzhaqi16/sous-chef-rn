'use no memo';
import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import type { MockFor } from '#/test-utils/apolloMockProvider';
import {
  renderWithApollo,
  recordMock,
  seedFragment,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  CreatePantryItemDocument,
  GetPantryItemSuggestionsDocument,
  RestockPantryItemDocument,
  type GetPantryItemSuggestionsQuery,
} from '#features/pantry/graphql/pantry.generated';
import {
  ErrorCode,
  PantrySuggestionSource,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { AddToPantrySheet } from '../AddToPantrySheet';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#features/pantry/hooks/usePantryItemSuggestions', () => ({
  PANTRY_SUGGESTIONS_LIMIT: 20,
  usePantryItemSuggestions: jest.fn(() => ({
    grouped: [],
    state: 'empty',
    refetch: jest.fn(),
  })),
}));

jest.mock('#/utils/connectionUtils', () => ({
  extractNodes: jest.fn(() => []),
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
    shouldFetch: true,
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

  // Scanning a receipt is in Pantry's + menu now; the sheet only opens on the
  // step it is asked for.
  it("opens on the details form for the + menu's Add manually", () => {
    renderWithApollo(
      <AddToPantrySheet {...defaultProps} startStep="details" />,
    );
    expect(sheetProps.current.startStep).toBe('details');
    expect(sheetProps.current.receiptAction).toBeUndefined();
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
      state: 'ready',
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
      state: 'loading',
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
    const forbidden: MockFor<typeof CreatePantryItemDocument> = {
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
   * USM-2: an add of a held product is forced, so the server joins it to the
   * stack it holds and answers with that stack's id. The optimistic add moved
   * `Pantry.stats.totalItems` and the connection's `totalCount`, which the
   * header and the "All" tab badge read; the join must leave both where they
   * started, or the count is one too high per joined add.
   */
  describe('a joined add leaves the header count where it started', () => {
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
      seedQuery(cache, {
        query: SEED_PANTRY,
        variables: { id: 'pantry-1' },
        data: {
          pantry: {
            __typename: 'Pantry',
            version: 1,
            id: 'pantry-1',
            stats: { __typename: 'PantryStats', totalItems: 70 },
            itemsConnection: {
              __typename: 'PantryItemConnection',
              totalCount: 70,
              edges: [
                {
                  __typename: 'PantryItemEdge',
                  cursor: 'pi-1',
                  node: { __typename: 'PantryItem', version: 1, id: 'pi-1' },
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

    const joined: MockFor<typeof CreatePantryItemDocument> = {
      request: {
        query: CreatePantryItemDocument,
        variables: () => true,
      },
      result: {
        data: {
          createPantryItem: {
            __typename: 'CreatePantryItemPayload',
            // The held stack's id, not the minted one: the add joined it.
            pantryItem: { __typename: 'PantryItem', version: 1, id: 'pi-1' },
            pantry: {
              __typename: 'Pantry',
              version: 1,
              id: 'pantry-1',
              stats: { __typename: 'PantryStats', totalItems: 70 },
            },
          },
        },
      },
    };

    it('reverses both counters the optimistic add moved', async () => {
      const cache = seedCache();
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache,
        operationMocks: [joined],
      });

      const quickAdd = sheetProps.current.onQuickAddSearchSuggestion as (
        item: unknown,
      ) => void;
      quickAdd({ id: 'item-1', name: 'Milk' });

      // The optimistic write lands synchronously, before the answer arrives.
      expect(readTotals(cache)).toEqual({ totalItems: 71, totalCount: 71 });

      await waitFor(() =>
        expect(readTotals(cache)).toEqual({ totalItems: 70, totalCount: 70 }),
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
                unit {
                  __typename
                  id
                  symbol
                  localizedSymbolForms {
                    one
                    other
                  }
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
      seedQuery(cache, {
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
            version: 1,
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
        version: 1,
        id: 'pi-1',
        itemName: 'Milk',
        quantity: 3,
        item: { __typename: 'Item', version: 1, id: 'item-1' },
        unit: asAbbreviation({ __typename: 'Unit', id: 'unit-l', symbol: 'L' }),
      },
    };

    // A search suggestion names the unit a one-tap add is created in.
    const milkInLitres = {
      id: 'item-1',
      name: 'Milk',
      defaultUnit: { __typename: 'ItemUnitSuggestion', id: 'unit-l' },
    };

    const restockData = {
      restockPantryItem: {
        __typename: 'RestockPantryItemPayload',
        pantryItemUsage: {
          __typename: 'PantryItemUsage',
          id: 'usage-1',
          pantryItem: { __typename: 'PantryItem', version: 1, id: 'pi-1' },
        },
      },
    } as const;
    const restocked: MockFor<typeof RestockPantryItemDocument> = {
      request: { query: RestockPantryItemDocument, variables: () => true },
      result: { data: restockData },
    };

    const readQuantity = (cache: ReturnType<typeof makeCache>) =>
      cache.readFragment<{ quantity: number }>({
        id: 'PantryItem:pi-1',
        fragment: QUANTITY,
      })?.quantity;

    it('restocks the row it can see instead of firing a create', async () => {
      const cache = seedStocked([stockedEdge]);
      typedUnit(cache, 'unit-l', UnitType.Count);
      const create = recordMock(CreatePantryItemDocument, {
        data: {
          createPantryItem: {
            __typename: 'CreatePantryItemPayload',
            pantryItem: { __typename: 'PantryItem', version: 1, id: 'pi-new' },
          },
        },
      });
      const restock = recordMock(RestockPantryItemDocument, {
        data: restockData,
      });
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache,
        operationMocks: [create.mock, restock.mock],
      });

      const quickAdd = sheetProps.current.onQuickAddSearchSuggestion as (
        item: unknown,
      ) => void;
      quickAdd(milkInLitres);

      await waitFor(() =>
        expect(toastService.success).toHaveBeenCalledWith('Restocked Milk'),
      );
      // The point of the whole exercise: nothing was queued that the server would
      // only refuse, so there is nothing to undo on reconnect.
      expect(create.fired).toHaveLength(0);
      // The restock carries the day it was made, which dates its default expiry.
      const [fired] = restock.fired;
      expect(fired?.input).toMatchObject({
        today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
      expect(fired?.input).toMatchObject({ today: fired?.today });
      expect(toastService.error).not.toHaveBeenCalled();
      // Once, not twice — the generic "Added" toast must not fire alongside it.
      expect(toastService.success).toHaveBeenCalledTimes(1);
    });

    const typedUnit = (
      cache: ReturnType<typeof makeCache>,
      id: string,
      type: UnitType,
    ) =>
      seedFragment(cache, {
        id: `Unit:${id}`,
        fragment: gql`
          fragment StockedUnitType on Unit {
            id
            type
          }
        `,
        data: { __typename: 'Unit', id, type },
      });

    it('bumps a counted stack locally, so the change shows before the server replies', () => {
      // Offline the restock's `update` never runs. Without the local write the
      // toast would claim a change the list does not show.
      const cache = seedStocked([stockedEdge]);
      typedUnit(cache, 'unit-l', UnitType.Count);
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache,
        operationMocks: [restocked],
      });

      const quickAdd = sheetProps.current.onQuickAddSearchSuggestion as (
        item: unknown,
      ) => void;
      quickAdd(milkInLitres);

      expect(readQuantity(cache)).toBe(4);
    });

    it('restocks a stack held by volume by one package for the server to size, never 1 L', async () => {
      // A forced add would name no stack, and could land on another one.
      const cache = seedStocked([stockedEdge]);
      typedUnit(cache, 'unit-l', UnitType.Volume);
      const create = recordMock(CreatePantryItemDocument, {
        data: { createPantryItem: null },
      });
      const restock = recordMock(RestockPantryItemDocument, {
        data: restockData,
      });
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache,
        operationMocks: [create.mock, restock.mock],
      });

      const quickAdd = sheetProps.current.onQuickAddSearchSuggestion as (
        item: unknown,
      ) => void;
      quickAdd(milkInLitres);

      await waitFor(() => expect(restock.fired).toHaveLength(1));
      expect(restock.fired[0]?.input).toMatchObject({
        id: 'pi-1',
        amount: { packages: { count: 1 } },
      });
      expect(create.fired).toHaveLength(0);
      // The held litres never move by 1 L.
      expect(readQuantity(cache)).toBe(3);
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
      quickAdd(milkInLitres);

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

    it('leaves a stack held in another unit alone', async () => {
      // Held in litres, added in millilitres: restocking would add 1 L.
      const cache = seedStocked([stockedEdge]);
      const create = recordMock(CreatePantryItemDocument, {
        data: {
          createPantryItem: {
            __typename: 'CreatePantryItemPayload',
            pantryItem: { __typename: 'PantryItem', version: 1, id: 'pi-new' },
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
      quickAdd({
        ...milkInLitres,
        defaultUnit: { __typename: 'ItemUnitSuggestion', id: 'unit-ml' },
      });

      await waitFor(() => expect(create.fired).toHaveLength(1));
      expect(readQuantity(cache)).toBe(3);
      expect(toastService.success).not.toHaveBeenCalledWith('Restocked Milk');
    });

    it('leaves an add whose unit it cannot know to the server', async () => {
      const cache = seedStocked([stockedEdge]);
      const create = recordMock(CreatePantryItemDocument, {
        data: {
          createPantryItem: {
            __typename: 'CreatePantryItemPayload',
            pantryItem: { __typename: 'PantryItem', version: 1, id: 'pi-new' },
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
      quickAdd({ id: 'item-1', name: 'Milk', defaultUnit: null });

      await waitFor(() => expect(create.fired).toHaveLength(1));
      expect(readQuantity(cache)).toBe(3);
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
            pantryItem: { __typename: 'PantryItem', version: 1, id: 'pi-new' },
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

  describe('a row that names its stack', () => {
    const suggestionRow = (
      source: PantrySuggestionSource,
      pantryItemId: string,
    ) => ({
      __typename: 'PantryItemSuggestion',
      id: pantryItemId,
      itemId: 'item-1',
      name: 'Milk',
      source,
      category: null,
      imageUrl: null,
      defaultUnitId: 'unit-l',
      pantryItemId,
    });

    const recordCreate = () =>
      recordMock(CreatePantryItemDocument, {
        data: {
          createPantryItem: {
            __typename: 'CreatePantryItemPayload',
            pantryItem: { __typename: 'PantryItem', version: 1, id: 'pi-new' },
          },
        },
      });

    const recordRestock = () =>
      recordMock(RestockPantryItemDocument, {
        data: {
          restockPantryItem: {
            __typename: 'RestockPantryItemPayload',
            pantryItemUsage: {
              __typename: 'PantryItemUsage',
              id: 'usage-1',
              pantryItem: {
                __typename: 'PantryItem',
                version: 1,
                id: 'pi-held',
              },
            },
          },
        },
      });

    it('restocks the item a low-stock row names, even past the loaded window', async () => {
      const create = recordCreate();
      const restock = recordRestock();
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache: makeCache(),
        operationMocks: [create.mock, restock.mock],
      });

      const quickAdd = sheetProps.current.onQuickAddSuggestion as (
        row: unknown,
      ) => void;
      quickAdd(suggestionRow(PantrySuggestionSource.LowStock, 'pi-held'));

      // The stack is past the loaded window, so its unit is unknown: the
      // server sizes the package, on the stack the row names.
      await waitFor(() => expect(restock.fired).toHaveLength(1));
      expect(restock.fired[0]).toMatchObject({
        input: { id: 'pi-held', amount: { packages: { count: 1 } } },
      });
      expect(create.fired).toHaveLength(0);
      await waitFor(() =>
        expect(toastService.success).toHaveBeenCalledWith('Restocked Milk'),
      );
    });

    describe('a restock the server cannot size', () => {
      const unsized = () =>
        recordMock(RestockPantryItemDocument, {
          data: {
            restockPantryItem: {
              __typename: 'ValidationError',
              code: ErrorCode.ValidationFailed,
              message: 'state how much one package holds',
              field: 'amount.packages.size',
            },
          },
        });

      const tapExpiring = () => {
        const quickAdd = sheetProps.current.onQuickAddSuggestion as (
          row: unknown,
        ) => void;
        quickAdd(suggestionRow(PantrySuggestionSource.ExpiringSoon, 'pi-held'));
      };

      it('asks for the amount on the restock form, with no toast', async () => {
        const onRestockNeedsAmount = jest.fn(() => true);
        renderWithApollo(
          <AddToPantrySheet
            {...defaultProps}
            onRestockNeedsAmount={onRestockNeedsAmount}
          />,
          { cache: makeCache(), operationMocks: [unsized().mock] },
        );

        tapExpiring();

        await waitFor(() =>
          expect(onRestockNeedsAmount).toHaveBeenCalledWith(
            'pi-held',
            expect.stringContaining('how much one package'),
          ),
        );
        expect(toastService.success).not.toHaveBeenCalled();
        expect(toastService.error).not.toHaveBeenCalled();
        expect(defaultProps.onItemAdded).not.toHaveBeenCalled();
      });

      it('says why on a toast when no form can ask', async () => {
        renderWithApollo(
          <AddToPantrySheet
            {...defaultProps}
            onRestockNeedsAmount={() => false}
          />,
          { cache: makeCache(), operationMocks: [unsized().mock] },
        );

        tapExpiring();

        await waitFor(() =>
          expect(toastService.error).toHaveBeenCalledWith(
            expect.stringContaining('how much one package'),
          ),
        );
        expect(toastService.success).not.toHaveBeenCalled();
      });
    });

    it('adds an Add Again row, never restocking the removed stack it names', async () => {
      const create = recordCreate();
      const restock = recordRestock();
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache: makeCache(),
        operationMocks: [create.mock, restock.mock],
      });

      const quickAdd = sheetProps.current.onQuickAddSuggestion as (
        row: unknown,
      ) => void;
      quickAdd(suggestionRow(PantrySuggestionSource.RecentlyDeleted, 'pi-old'));

      await waitFor(() => expect(create.fired).toHaveLength(1));
      expect(restock.fired).toHaveLength(0);
    });
  });

  /**
   * A suggestion leaves the cache on the tap, so fast taps on different ones
   * all go ahead, and a refusal puts back only its own suggestion, at its old
   * place, without asking for the list again.
   */
  describe('suggestion tiles under fast taps', () => {
    type Sections = NonNullable<
      GetPantryItemSuggestionsQuery['pantry']
    >['suggestions'];
    // `today` only moves the expiring window; the cache does not key on it.
    const VARIABLES = { pantryId: 'pantry-1', limit: 20, today: '2026-10-28' };

    const popularRow = (itemId: string): Sections['popular'][number] => ({
      __typename: 'PantryItemSuggestion',
      id: `popular-${itemId}`,
      itemId,
      name: itemId,
      source: PantrySuggestionSource.Popular,
      category: null,
      imageUrl: null,
      defaultUnitId: null,
      pantryItemId: null,
    });

    const seedSuggestions = (
      popular: string[],
      lowStock: Sections['lowStock'] = [],
    ) => {
      const cache = makeCache();
      seedQuery(cache, {
        query: GetPantryItemSuggestionsDocument,
        variables: VARIABLES,
        data: {
          __typename: 'Query',
          pantry: {
            __typename: 'Pantry',
            version: 1,
            id: 'pantry-1',
            suggestions: {
              __typename: 'PantrySuggestions',
              lowStock,
              expiringSoon: [],
              recentlyDeleted: [],
              frequentlyAdded: [],
              popular: popular.map(popularRow),
            },
          },
        },
      });
      return cache;
    };

    const shown = (cache: ReturnType<typeof makeCache>) => {
      const sections = cache.readQuery({
        query: GetPantryItemSuggestionsDocument,
        variables: VARIABLES,
      })?.pantry?.suggestions;
      return {
        lowStock: sections?.lowStock.map(s => s.itemId),
        popular: sections?.popular.map(s => s.itemId),
      };
    };

    /** The row a tile hands its handler, as `usePantryItemSuggestions` maps it. */
    const tile = (itemId: string, extra: Record<string, unknown> = {}) => ({
      id: `popular-${itemId}`,
      itemId,
      name: itemId,
      source: PantrySuggestionSource.Popular,
      pantryItemId: null,
      defaultUnitId: null,
      ...extra,
    });

    const quickAdd = (item: unknown) =>
      (sheetProps.current.onQuickAddSuggestion as (row: unknown) => void)(item);

    const created = (match?: (variables: unknown) => boolean) =>
      recordMock(CreatePantryItemDocument, {
        data: {
          createPantryItem: {
            __typename: 'CreatePantryItemPayload',
            pantryItem: { __typename: 'PantryItem', version: 1, id: 'pi-new' },
          },
        },
        ...(match ? { match } : {}),
      });

    const refusedCreate = (match: (variables: unknown) => boolean) =>
      recordMock(CreatePantryItemDocument, {
        data: {
          createPantryItem: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'No add-items access',
          },
        },
        match,
      });

    const names = (itemId: string) => (variables: unknown) =>
      JSON.stringify(variables).includes(`"${itemId}"`);

    it('lets two quick adds on different suggestions both go ahead', async () => {
      const cache = seedSuggestions(['apples', 'bread', 'cheese']);
      const create = created();
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache,
        operationMocks: [create.mock],
      });

      quickAdd(tile('apples'));
      quickAdd(tile('bread'));

      expect(shown(cache).popular).toEqual(['cheese']);
      await waitFor(() => expect(create.fired).toHaveLength(2));
    });

    it('sends one add for a double tap', async () => {
      const cache = seedSuggestions(['apples', 'bread']);
      const create = created();
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache,
        operationMocks: [create.mock],
      });

      quickAdd(tile('apples'));
      quickAdd(tile('apples'));

      await waitFor(() => expect(create.fired).toHaveLength(1));
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(create.fired).toHaveLength(1);
    });

    it('puts back only the refused suggestion, at its old place', async () => {
      const cache = seedSuggestions(['apples', 'bread', 'cheese']);
      const refused = refusedCreate(names('apples'));
      const accepted = created(names('bread'));
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache,
        operationMocks: [refused.mock, accepted.mock],
      });

      quickAdd(tile('apples'));
      quickAdd(tile('bread'));

      await waitFor(() =>
        expect(shown(cache).popular).toEqual(['apples', 'cheese']),
      );
      expect(toastService.error).toHaveBeenCalledTimes(1);
    });

    it('puts back a held-stack suggestion whose restock is refused', async () => {
      const cache = seedSuggestions(
        [],
        [
          {
            ...popularRow('milk'),
            id: 'low-milk',
            source: PantrySuggestionSource.LowStock,
            pantryItemId: 'pi-9',
            currentQuantity: null,
            defaultUnit: null,
          },
        ],
      );
      const restock = recordMock(RestockPantryItemDocument, {
        data: {
          restockPantryItem: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'No add-items access',
          },
        },
      });
      renderWithApollo(<AddToPantrySheet {...defaultProps} />, {
        cache,
        operationMocks: [restock.mock],
      });

      quickAdd(
        tile('milk', {
          id: 'low-milk',
          source: PantrySuggestionSource.LowStock,
          pantryItemId: 'pi-9',
        }),
      );

      expect(shown(cache).lowStock).toEqual([]);
      await waitFor(() => expect(shown(cache).lowStock).toEqual(['milk']));
      expect(toastService.error).toHaveBeenCalledTimes(1);
    });
  });
});
