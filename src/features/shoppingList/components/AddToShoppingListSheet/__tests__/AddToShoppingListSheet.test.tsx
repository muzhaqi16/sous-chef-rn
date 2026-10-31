import React from 'react';
import { act } from '@testing-library/react-native';
import {
  renderWithApollo,
  recordMock,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { makeCache } from '#/apollo/cache';
import {
  AddItemToShoppingListDocument,
  GetShoppingListSuggestionsDocument,
  type GetShoppingListSuggestionsQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { AddToShoppingListSheet } from '../AddToShoppingListSheet';

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#features/shoppingList/hooks/useShoppingListSuggestions', () => ({
  SHOPPING_SUGGESTIONS_LIMIT: 20,
  useShoppingListSuggestions: jest.fn(() => ({
    grouped: {},
    state: 'empty',
    refetch: jest.fn(),
  })),
}));

jest.mock('#features/catalog/ui/AddItemSheet/useAddItemSheetState', () => ({
  useAddItemSheetState: jest.fn(() => ({ shouldFetch: true })),
}));

jest.mock('../ShoppingListDetailsStep', () => ({
  ShoppingListDetailsStep: () => null,
}));

/**
 * The quick-add handlers are props on `AddItemSheet`, which is mocked away, so
 * the mock parks them here for a test to call.
 */
const sheetProps: { current: Record<string, unknown> } = { current: {} };

jest.mock('#features/catalog/ui/AddItemSheet/AddItemSheet', () => ({
  AddItemSheet: (props: Record<string, unknown>) => {
    sheetProps.current = props;
    return null;
  },
}));

type Sections = NonNullable<
  GetShoppingListSuggestionsQuery['shoppingList']
>['suggestions'];

const VARIABLES = { id: 'list-1', limit: 20 };

const row = (itemId: string): Sections['popular'][number] => ({
  __typename: 'ShoppingListSuggestion',
  id: `sug-${itemId}`,
  itemId,
  name: itemId,
  category: null,
  imageUrl: null,
  defaultUnitId: null,
});

const seedSuggestions = (popular: string[]) => {
  const cache = makeCache();
  seedQuery(cache, {
    query: GetShoppingListSuggestionsDocument,
    variables: VARIABLES,
    data: {
      __typename: 'Query',
      shoppingList: {
        __typename: 'ShoppingList',
        version: 1,
        id: 'list-1',
        suggestions: {
          __typename: 'ShoppingListSuggestions',
          recentlyDeleted: [],
          frequentlyAdded: [],
          popular: popular.map(row),
        },
      },
    },
  });
  return cache;
};

const shown = (cache: ReturnType<typeof makeCache>) =>
  cache
    .readQuery({
      query: GetShoppingListSuggestionsDocument,
      variables: VARIABLES,
    })
    ?.shoppingList?.suggestions.popular.map(s => s.itemId);

/** The row a tile hands its handler, as `useShoppingListSuggestions` maps it. */
const tile = (itemId: string) => ({
  id: `sug-${itemId}`,
  itemId,
  name: itemId,
  defaultUnitId: null,
});

const quickAdd = (item: unknown) =>
  (sheetProps.current.onQuickAddSuggestion as (row: unknown) => Promise<void>)(
    item,
  );

const names = (itemId: string) => (variables: unknown) =>
  JSON.stringify(variables).includes(`"${itemId}"`);

const added = (itemId: string, held = false) =>
  recordMock(AddItemToShoppingListDocument, {
    held,
    match: names(itemId),
    data: {
      addItemsToShoppingList: {
        __typename: 'AddItemsToShoppingListPayload',
        results: [{ success: true, item: { id: `srv-${itemId}` } }],
      },
    },
  });

const renderSheet = (
  cache: ReturnType<typeof makeCache>,
  operationMocks: NonNullable<
    Parameters<typeof renderWithApollo>[1]
  >['operationMocks'],
) =>
  renderWithApollo(
    <AddToShoppingListSheet
      visible
      shoppingListId="list-1"
      onClose={jest.fn()}
    />,
    { cache, operationMocks },
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AddToShoppingListSheet quick add under fast taps', () => {
  it('lets a second suggestion go ahead while the first add is in flight', async () => {
    const cache = seedSuggestions(['apples', 'bread', 'cheese']);
    const apples = added('apples', true);
    const bread = added('bread');
    renderSheet(cache, [apples.mock, bread.mock]);

    void quickAdd(tile('apples'));
    const breadAdded = quickAdd(tile('bread'));

    expect(shown(cache)).toEqual(['cheese']);
    await act(() => breadAdded);
    expect(bread.fired).toHaveLength(1);
    expect(apples.fired).toHaveLength(1);

    act(() => {
      apples.release();
    });
  });

  it('sends one add for a double tap', async () => {
    const cache = seedSuggestions(['apples', 'bread']);
    const apples = added('apples');
    renderSheet(cache, [apples.mock]);

    // Each tap settles only with its own add, so a second send is in by then.
    await act(() =>
      Promise.all([quickAdd(tile('apples')), quickAdd(tile('apples'))]),
    );

    expect(apples.fired).toHaveLength(1);
  });

  it('puts back a refused suggestion at its old place', async () => {
    const cache = seedSuggestions(['apples', 'bread']);
    const refused = recordMock(AddItemToShoppingListDocument, {
      data: {
        addItemsToShoppingList: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
        },
      },
    });
    renderSheet(cache, [refused.mock]);

    const refusal = quickAdd(tile('apples'));

    expect(shown(cache)).toEqual(['bread']);
    await act(() => refusal);
    expect(shown(cache)).toEqual(['apples', 'bread']);
    expect(toastService.error).toHaveBeenCalledTimes(1);
  });
});
