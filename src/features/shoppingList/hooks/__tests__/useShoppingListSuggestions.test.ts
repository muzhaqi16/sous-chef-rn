import { waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { GetShoppingListSuggestionsDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { SuggestionSource } from '#/graphql/generated/schemaTypes';
import { useShoppingListSuggestions } from '../useShoppingListSuggestions';

// --- Mocks ---

let mockIsOffline = false;

jest.mock('#hooks/settings/useOfflineMode', () => ({
  useIsEffectivelyOffline: () => mockIsOffline,
}));

jest.mock('#utils/imageUtils', () => ({
  resolveImageUrl: jest.fn(() => null),
}));

jest.mock('#components/atoms/CachedImage', () => ({
  preloadImages: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsOffline = false;
});

interface SuggestionInput {
  id: string;
  source: SuggestionSource;
  itemName?: string;
}

function buildSuggestion(input: SuggestionInput) {
  return {
    __typename: 'ShoppingListSuggestion',
    id: input.id,
    itemId: `item-${input.id}`,
    name: input.itemName ?? `Item ${input.id}`,
    source: input.source,
    imageUrl: null,
    category: null,
    defaultUnitId: null,
    defaultUnit: null,
    item: null,
    lastQuantity: null,
    lastUnitId: null,
    frequencyCount: null,
    popularityRank: null,
    shoppingListItemId: null,
  };
}

function buildSuggestionsMock(
  listId: string,
  suggestions: ReturnType<typeof buildSuggestion>[],
  limit = 15,
): MockedResponse {
  return {
    request: {
      query: GetShoppingListSuggestionsDocument,
      variables: { id: listId, limit },
    },
    result: {
      data: {
        shoppingList: {
          __typename: 'ShoppingList',
          id: listId,
          suggestions,
        },
      },
    },
    maxUsageCount: 10,
  };
}

function buildSuggestionsErrorMock(
  listId: string,
  error: Error,
  limit = 15,
): MockedResponse {
  return {
    request: {
      query: GetShoppingListSuggestionsDocument,
      variables: { id: listId, limit },
    },
    error,
    maxUsageCount: 10,
  };
}

describe('useShoppingListSuggestions', () => {
  it('returns empty state when no data', async () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListSuggestions({ shoppingListId: 'list-1' }),
      {
        operationMocks: [buildSuggestionsMock('list-1', [])],
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.hasSuggestions).toBe(false);
    expect(result.current.grouped.recentlyDeleted).toEqual([]);
    expect(result.current.grouped.frequentlyAdded).toEqual([]);
    expect(result.current.grouped.popular).toEqual([]);
  });

  it('groups suggestions by source', async () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListSuggestions({ shoppingListId: 'list-1' }),
      {
        operationMocks: [
          buildSuggestionsMock('list-1', [
            buildSuggestion({
              id: '1',
              source: SuggestionSource.RecentlyDeleted,
            }),
            buildSuggestion({
              id: '2',
              source: SuggestionSource.FrequentlyAdded,
            }),
            buildSuggestion({ id: '3', source: SuggestionSource.Popular }),
            buildSuggestion({
              id: '4',
              source: SuggestionSource.RecentlyDeleted,
            }),
          ]),
        ],
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.grouped.recentlyDeleted).toHaveLength(2);
    expect(result.current.grouped.frequentlyAdded).toHaveLength(1);
    expect(result.current.grouped.popular).toHaveLength(1);
    expect(result.current.hasSuggestions).toBe(true);
  });

  it('returns all suggestions in flat array', async () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListSuggestions({ shoppingListId: 'list-1' }),
      {
        operationMocks: [
          buildSuggestionsMock('list-1', [
            buildSuggestion({
              id: '1',
              source: SuggestionSource.RecentlyDeleted,
            }),
            buildSuggestion({ id: '2', source: SuggestionSource.Popular }),
          ]),
        ],
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.suggestions).toHaveLength(2);
  });

  it('returns empty suggestions when offline', async () => {
    mockIsOffline = true;

    const { result } = renderHookWithApollo(
      () => useShoppingListSuggestions({ shoppingListId: 'list-1' }),
      {
        operationMocks: [
          buildSuggestionsMock('list-1', [
            buildSuggestion({ id: '1', source: SuggestionSource.Popular }),
          ]),
        ],
      },
    );

    // Hook short-circuits on offline → never calls network → suggestions stays []
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.hasSuggestions).toBe(false);
    expect(result.current.isOffline).toBe(true);
  });

  it('exposes loading state initially', () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListSuggestions({ shoppingListId: 'list-1' }),
      {
        operationMocks: [buildSuggestionsMock('list-1', [])],
      },
    );

    expect(typeof result.current.loading).toBe('boolean');
  });

  it('exposes error state', async () => {
    const testError = new Error('Network error');
    const { result } = renderHookWithApollo(
      () => useShoppingListSuggestions({ shoppingListId: 'list-1' }),
      {
        operationMocks: [buildSuggestionsErrorMock('list-1', testError)],
      },
    );

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.error?.message).toContain('Network error');
  });

  it('exposes refetch function', async () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListSuggestions({ shoppingListId: 'list-1' }),
      {
        operationMocks: [buildSuggestionsMock('list-1', [])],
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.refetch).toBe('function');
  });

  it('hasSuggestions is false when all groups are empty', async () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListSuggestions({ shoppingListId: 'list-1' }),
      {
        operationMocks: [buildSuggestionsMock('list-1', [])],
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasSuggestions).toBe(false);
  });
});
