import { act, waitFor } from '@testing-library/react-native';
import type { MockFor, MockPart } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useStore } from '#store';
import {
  GetShoppingListSuggestionsDocument,
  type GetShoppingListSuggestionsQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { SuggestionSource } from '#/graphql/generated/schemaTypes';
import { useShoppingListSuggestions } from '../useShoppingListSuggestions';

jest.mock('#utils/imageUtils', () => ({
  resolveImageUrl: jest.fn(() => null),
}));

jest.mock('#components/atoms/CachedImage', () => ({
  preloadImages: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({ isOnline: true, apiReachable: true });
});

interface SuggestionInput {
  id: string;
  source: SuggestionSource;
  itemName?: string;
}

type Suggestion = NonNullable<
  GetShoppingListSuggestionsQuery['shoppingList']
>['recentlyDeleted'][number];

function buildSuggestion(input: SuggestionInput): MockPart<Suggestion> {
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
  limit = 20,
): MockFor<typeof GetShoppingListSuggestionsDocument> {
  // Each source is fetched via its own aliased field; bucket the flat input.
  const bySource = (source: SuggestionSource) =>
    suggestions.filter(s => s.source === source);
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
          recentlyDeleted: bySource(SuggestionSource.RecentlyDeleted),
          frequentlyAdded: bySource(SuggestionSource.FrequentlyAdded),
          popular: bySource(SuggestionSource.Popular),
        },
      },
    },
    maxUsageCount: 10,
  };
}

function buildSuggestionsErrorMock(
  listId: string,
  error: Error,
  limit = 20,
): MockFor<typeof GetShoppingListSuggestionsDocument> {
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
  it('is loading before the network resolves', () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListSuggestions({ shoppingListId: 'list-1' }),
      { operationMocks: [buildSuggestionsMock('list-1', [])] },
    );

    expect(result.current.state).toBe('loading');
  });

  it('is empty when the server has no suggestions', async () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListSuggestions({ shoppingListId: 'list-1' }),
      { operationMocks: [buildSuggestionsMock('list-1', [])] },
    );

    await waitFor(() => expect(result.current.state).toBe('empty'));
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

    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.grouped.recentlyDeleted).toHaveLength(2);
    expect(result.current.grouped.frequentlyAdded).toHaveLength(1);
    expect(result.current.grouped.popular).toHaveLength(1);
  });

  it('is an error, not empty, when the read fails online', async () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListSuggestions({ shoppingListId: 'list-1' }),
      {
        operationMocks: [
          buildSuggestionsErrorMock('list-1', new Error('Network error')),
        ],
      },
    );

    await waitFor(() => expect(result.current.state).toBe('error'));
  });

  it('is offline, not empty, when the server is unreachable and nothing was cached', async () => {
    useStore.setState({ isOnline: false, apiReachable: null });
    const { result } = renderHookWithApollo(
      () => useShoppingListSuggestions({ shoppingListId: 'list-1' }),
      {
        operationMocks: [
          buildSuggestionsErrorMock('list-1', new Error('Network error')),
        ],
      },
    );

    await waitFor(() => expect(result.current.state).toBe('offline'));
  });

  it('retries the read', async () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListSuggestions({ shoppingListId: 'list-1' }),
      {
        operationMocks: [
          {
            ...buildSuggestionsErrorMock('list-1', new Error('Network error')),
            maxUsageCount: 1,
          },
          buildSuggestionsMock('list-1', [
            buildSuggestion({ id: '1', source: SuggestionSource.Popular }),
          ]),
        ],
      },
    );
    await waitFor(() => expect(result.current.state).toBe('error'));

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.state).toBe('ready'));
  });

  it('does not read without a list id', () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListSuggestions({ shoppingListId: undefined }),
      { operationMocks: [] },
    );

    expect(result.current.state).toBe('empty');
  });
});
