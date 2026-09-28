import { act, waitFor } from '@testing-library/react-native';
import type { MockFor } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { makeCache } from '#/apollo/cache';
import { useStore } from '#store';
import {
  GetPantryItemSuggestionsDocument,
  type GetPantryItemSuggestionsQuery,
} from '#features/pantry/graphql/pantry.generated';
import { PantrySuggestionSource } from '#/graphql/generated/schemaTypes';
import { usePantryItemSuggestions } from '../usePantryItemSuggestions';
import { toDateKey } from '#/utils/dateUtils';

jest.mock('#utils/imageUtils', () => ({
  resolveImageUrl: (item: { imageUrl?: string | null } | null | undefined) =>
    item?.imageUrl ? `https://cdn.test/${item.imageUrl}` : null,
}));

const mockPreloadImages = jest.fn();
jest.mock('#components/atoms/CachedImage', () => ({
  preloadImages: (...args: unknown[]) => mockPreloadImages(...args),
}));

type Sections = NonNullable<
  GetPantryItemSuggestionsQuery['pantry']
>['suggestions'];
// Every section's fields, so one builder serves them all.
type Suggestion = Sections['lowStock'][number] &
  Sections['expiringSoon'][number];

function makeSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    __typename: 'PantryItemSuggestion',
    id: 'sug-1',
    itemId: 'item-1',
    name: 'Milk',
    source: PantrySuggestionSource.LowStock,
    category: null,
    imageUrl: 'milk.jpg',
    defaultUnitId: null,
    pantryItemId: null,
    currentQuantity: null,
    defaultUnit: null,
    daysUntilExpiry: null,
    ...overrides,
  };
}

const TODAY = toDateKey(new Date());
const VARIABLES = { pantryId: 'pantry-1', limit: 20, today: TODAY };

/** The fields every section selects. */
const baseRow = (s: Suggestion) => ({
  __typename: s.__typename,
  id: s.id,
  itemId: s.itemId,
  name: s.name,
  source: s.source,
  category: s.category,
  imageUrl: s.imageUrl,
  defaultUnitId: s.defaultUnitId,
  pantryItemId: s.pantryItemId,
});

function buildData(suggestions: Suggestion[]): GetPantryItemSuggestionsQuery {
  // Each row's `source` repeats its section; bucket the flat input, keeping
  // only what that section selects.
  const bySource = (source: PantrySuggestionSource) =>
    suggestions.filter(s => s.source === source);
  return {
    __typename: 'Query',
    pantry: {
      __typename: 'Pantry',
      id: 'pantry-1',
      suggestions: {
        __typename: 'PantrySuggestions',
        lowStock: bySource(PantrySuggestionSource.LowStock).map(s => ({
          ...baseRow(s),
          currentQuantity: s.currentQuantity,
          defaultUnit: s.defaultUnit,
        })),
        expiringSoon: bySource(PantrySuggestionSource.ExpiringSoon).map(s => ({
          ...baseRow(s),
          daysUntilExpiry: s.daysUntilExpiry,
        })),
        recentlyDeleted: bySource(PantrySuggestionSource.RecentlyDeleted).map(
          baseRow,
        ),
        frequentlyAdded: bySource(PantrySuggestionSource.FrequentlyAdded).map(
          baseRow,
        ),
        popular: bySource(PantrySuggestionSource.Popular).map(baseRow),
      },
    },
  };
}

function buildMock(
  suggestions: Suggestion[],
  variables = VARIABLES,
): MockFor<typeof GetPantryItemSuggestionsDocument> {
  return {
    request: { query: GetPantryItemSuggestionsDocument, variables },
    result: { data: buildData(suggestions) },
  };
}

const failedMock = (): MockFor<typeof GetPantryItemSuggestionsDocument> => ({
  request: { query: GetPantryItemSuggestionsDocument, variables: VARIABLES },
  error: new Error('Failed'),
});

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({ isOnline: true, apiReachable: true });
});

describe('usePantryItemSuggestions', () => {
  it('is loading before the network resolves', () => {
    const { result } = renderHookWithApollo(
      () => usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      { operationMocks: [buildMock([makeSuggestion()])] },
    );

    expect(result.current.state).toBe('loading');
    expect(result.current.grouped.lowStock).toEqual([]);
  });

  it('is ready with resolved image URLs once the network resolves', async () => {
    const { result } = renderHookWithApollo(
      () => usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      { operationMocks: [buildMock([makeSuggestion()])] },
    );

    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.grouped.lowStock?.[0]?.imageUrl).toBe(
      'https://cdn.test/milk.jpg',
    );
  });

  it('keeps a null imageUrl when the suggestion has no image', async () => {
    const { result } = renderHookWithApollo(
      () => usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      { operationMocks: [buildMock([makeSuggestion({ imageUrl: null })])] },
    );

    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.grouped.lowStock?.[0]?.imageUrl).toBeNull();
  });

  it('groups suggestions by source', async () => {
    const { result } = renderHookWithApollo(
      () => usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      {
        operationMocks: [
          buildMock([
            makeSuggestion({
              id: '1',
              source: PantrySuggestionSource.LowStock,
            }),
            makeSuggestion({
              id: '2',
              source: PantrySuggestionSource.ExpiringSoon,
            }),
            makeSuggestion({
              id: '3',
              source: PantrySuggestionSource.LowStock,
            }),
            makeSuggestion({ id: '4', source: PantrySuggestionSource.Popular }),
            makeSuggestion({
              id: '5',
              source: PantrySuggestionSource.FrequentlyAdded,
            }),
            makeSuggestion({
              id: '6',
              source: PantrySuggestionSource.RecentlyDeleted,
            }),
          ]),
        ],
      },
    );

    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.grouped.lowStock).toHaveLength(2);
    expect(result.current.grouped.expiringSoon).toHaveLength(1);
    expect(result.current.grouped.popular).toHaveLength(1);
    expect(result.current.grouped.frequentlyAdded).toHaveLength(1);
    expect(result.current.grouped.recentlyDeleted).toHaveLength(1);
  });

  describe('the context a row shows in place of its category', () => {
    const litres: Pick<Suggestion, 'defaultUnitId' | 'defaultUnit'> = {
      defaultUnitId: 'unit-l',
      defaultUnit: {
        __typename: 'SuggestionUnit',
        id: 'unit-l',
        symbol: 'L',
      },
    };

    const firstRows = async (suggestion: Suggestion) => {
      const { result } = renderHookWithApollo(
        () => usePantryItemSuggestions({ pantryId: 'pantry-1' }),
        { operationMocks: [buildMock([suggestion])] },
      );
      await waitFor(() => expect(result.current.state).toBe('ready'));
      return result.current.grouped;
    };

    it('says how much a low-stock stack has left', async () => {
      const grouped = await firstRows(
        makeSuggestion({ currentQuantity: 2, ...litres }),
      );
      expect(grouped.lowStock?.[0]?.subtitle).toBe('2 L left');
    });

    it('names no amount when the unit it has is not the stack unit', async () => {
      // The API's `defaultUnit` on a held-stack row is the item's default.
      const grouped = await firstRows(
        makeSuggestion({
          currentQuantity: 2,
          ...litres,
          defaultUnitId: 'unit-kg',
        }),
      );
      expect(grouped.lowStock?.[0]?.subtitle).toBeNull();
    });

    it('says when an expiring stack expires', async () => {
      const grouped = await firstRows(
        makeSuggestion({
          source: PantrySuggestionSource.ExpiringSoon,
          daysUntilExpiry: 1,
        }),
      );
      expect(grouped.expiringSoon?.[0]?.subtitle).toBe('Expires tomorrow');
    });

    it('leaves a catalog row to its category', async () => {
      const grouped = await firstRows(
        makeSuggestion({ source: PantrySuggestionSource.Popular }),
      );
      expect(grouped.popular?.[0]?.subtitle).toBeNull();
    });
  });

  it('is empty when the server has no suggestions', async () => {
    const { result } = renderHookWithApollo(
      () => usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      { operationMocks: [buildMock([])] },
    );

    await waitFor(() => expect(result.current.state).toBe('empty'));
  });

  describe('a read that produced nothing', () => {
    it('is an error when the read fails online', async () => {
      const { result } = renderHookWithApollo(
        () => usePantryItemSuggestions({ pantryId: 'pantry-1' }),
        { operationMocks: [failedMock()] },
      );

      await waitFor(() => expect(result.current.state).toBe('error'));
    });

    it('is offline when the server is unreachable and nothing was cached', async () => {
      useStore.setState({ isOnline: false, apiReachable: null });
      const { result } = renderHookWithApollo(
        () => usePantryItemSuggestions({ pantryId: 'pantry-1' }),
        { operationMocks: [failedMock()] },
      );

      await waitFor(() => expect(result.current.state).toBe('offline'));
    });

    it('retries the read', async () => {
      const { result } = renderHookWithApollo(
        () => usePantryItemSuggestions({ pantryId: 'pantry-1' }),
        { operationMocks: [failedMock(), buildMock([makeSuggestion()])] },
      );
      await waitFor(() => expect(result.current.state).toBe('error'));

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => expect(result.current.state).toBe('ready'));
    });
  });

  it('shows cached suggestions while offline', async () => {
    useStore.setState({ isOnline: false, apiReachable: null });
    const cache = makeCache();
    cache.writeQuery({
      query: GetPantryItemSuggestionsDocument,
      variables: VARIABLES,
      data: buildData([makeSuggestion()]),
    });

    // `offlineModeLink` answers an offline cache hit by re-emitting the cached
    // result; the mock stands in for it. A skipped read would never ask.
    const { result } = renderHookWithApollo(
      () => usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      { cache, operationMocks: [buildMock([makeSuggestion()])] },
    );

    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.grouped.lowStock).toHaveLength(1);
  });

  describe('image preloading', () => {
    it('preloads images when suggestions have URLs', async () => {
      const { result } = renderHookWithApollo(
        () => usePantryItemSuggestions({ pantryId: 'pantry-1' }),
        {
          operationMocks: [
            buildMock([
              makeSuggestion({ id: '1', imageUrl: 'img1.jpg' }),
              makeSuggestion({ id: '2', imageUrl: 'img2.jpg' }),
              makeSuggestion({ id: '3', imageUrl: null }),
            ]),
          ],
        },
      );

      await waitFor(() => expect(result.current.state).toBe('ready'));
      expect(mockPreloadImages).toHaveBeenCalledWith([
        'https://cdn.test/img1.jpg',
        'https://cdn.test/img2.jpg',
      ]);
    });

    it('does not preload when there are no suggestions', async () => {
      const { result } = renderHookWithApollo(
        () => usePantryItemSuggestions({ pantryId: 'pantry-1' }),
        { operationMocks: [buildMock([])] },
      );

      await waitFor(() => expect(result.current.state).toBe('empty'));
      expect(mockPreloadImages).not.toHaveBeenCalled();
    });
  });

  describe('skip conditions', () => {
    it('does not read without a pantryId', () => {
      const { result } = renderHookWithApollo(
        () => usePantryItemSuggestions({ pantryId: undefined }),
        { operationMocks: [] },
      );

      expect(result.current.state).toBe('empty');
    });

    it('does not read when skip is set', () => {
      const { result } = renderHookWithApollo(
        () => usePantryItemSuggestions({ pantryId: 'pantry-1', skip: true }),
        { operationMocks: [] },
      );

      expect(result.current.state).toBe('empty');
    });
  });

  it('passes a custom limit through to the query', async () => {
    const { result } = renderHookWithApollo(
      () => usePantryItemSuggestions({ pantryId: 'pantry-1', limit: 5 }),
      {
        operationMocks: [
          buildMock([makeSuggestion()], {
            pantryId: 'pantry-1',
            limit: 5,
            today: TODAY,
          }),
        ],
      },
    );

    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.grouped.lowStock).toHaveLength(1);
  });
});
