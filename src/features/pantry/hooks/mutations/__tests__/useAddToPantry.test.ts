import { act } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { makeCache } from '#/apollo/cache';
import {
  GetPantryItemSuggestionsDocument,
  type GetPantryItemSuggestionsQuery,
} from '#features/pantry/graphql/pantry.generated';
import { PantrySuggestionSource } from '#/graphql/generated/schemaTypes';
import { useAddToPantry } from '../useAddToPantry';

// `today` only moves the expiring window; the cache does not key on it.
const VARIABLES = { pantryId: 'pantry-1', limit: 20, today: '2026-10-28' };

type Sections = NonNullable<
  GetPantryItemSuggestionsQuery['pantry']
>['suggestions'];

const base = (
  itemId: string,
  source: PantrySuggestionSource,
): Sections['popular'][number] => ({
  __typename: 'PantryItemSuggestion',
  id: `${source}-${itemId}`,
  itemId,
  name: itemId,
  source,
  category: null,
  imageUrl: null,
  defaultUnitId: null,
  pantryItemId: null,
});

/** Each section's item ids, in order. */
interface Layout {
  lowStock?: string[];
  popular?: string[];
}

const buildData = ({
  lowStock = [],
  popular = [],
}: Layout): GetPantryItemSuggestionsQuery => ({
  __typename: 'Query',
  pantry: {
    __typename: 'Pantry',
    version: 1,
    id: 'pantry-1',
    suggestions: {
      __typename: 'PantrySuggestions',
      lowStock: lowStock.map(id => ({
        ...base(id, PantrySuggestionSource.LowStock),
        currentQuantity: null,
        defaultUnit: null,
      })),
      expiringSoon: [],
      recentlyDeleted: [],
      frequentlyAdded: [],
      popular: popular.map(id => base(id, PantrySuggestionSource.Popular)),
    },
  },
});

const seed = (layout: Layout) => {
  const cache = makeCache();
  seedQuery(cache, {
    query: GetPantryItemSuggestionsDocument,
    variables: VARIABLES,
    data: buildData(layout),
  });
  return cache;
};

const sectionsIn = (cache: ReturnType<typeof makeCache>) => {
  const sections = cache.readQuery({
    query: GetPantryItemSuggestionsDocument,
    variables: VARIABLES,
  })?.pantry?.suggestions;
  return {
    lowStock: sections?.lowStock.map(s => s.itemId),
    popular: sections?.popular.map(s => s.itemId),
  };
};

const renderAddToPantry = (cache: ReturnType<typeof makeCache>) =>
  renderHookWithApollo(
    () => useAddToPantry({ pantryId: 'pantry-1', suggestionsLimit: 20 }),
    { cache },
  ).result;

describe('useAddToPantry suggestion removal', () => {
  it('takes the item from every section that holds it', () => {
    const cache = seed({
      lowStock: ['milk', 'eggs'],
      popular: ['bread', 'milk'],
    });
    const result = renderAddToPantry(cache);

    act(() => {
      result.current.removeSuggestion('milk');
    });

    expect(sectionsIn(cache)).toEqual({
      lowStock: ['eggs'],
      popular: ['bread'],
    });
  });

  it('puts the item back at its old place in each section', () => {
    const cache = seed({
      lowStock: ['milk', 'eggs'],
      popular: ['bread', 'milk'],
    });
    const result = renderAddToPantry(cache);

    act(() => {
      result.current.restoreSuggestion(result.current.removeSuggestion('milk'));
    });

    expect(sectionsIn(cache)).toEqual({
      lowStock: ['milk', 'eggs'],
      popular: ['bread', 'milk'],
    });
  });

  // Another suggestion left meanwhile: the restored one goes to the end.
  it('restores into a section that has since shrunk', () => {
    const cache = seed({ popular: ['bread', 'eggs', 'milk'] });
    const result = renderAddToPantry(cache);

    act(() => {
      const milk = result.current.removeSuggestion('milk');
      result.current.removeSuggestion('eggs');
      result.current.restoreSuggestion(milk);
    });

    expect(sectionsIn(cache).popular).toEqual(['bread', 'milk']);
  });

  it('restores once however often it is asked', () => {
    const cache = seed({ popular: ['bread', 'milk'] });
    const result = renderAddToPantry(cache);

    act(() => {
      const milk = result.current.removeSuggestion('milk');
      result.current.restoreSuggestion(milk);
      result.current.restoreSuggestion(milk);
    });

    expect(sectionsIn(cache).popular).toEqual(['bread', 'milk']);
  });

  it('takes nothing a second time', () => {
    const cache = seed({ popular: ['bread', 'milk'] });
    const result = renderAddToPantry(cache);

    let second: ReturnType<typeof result.current.removeSuggestion> = null;
    act(() => {
      result.current.removeSuggestion('milk');
      second = result.current.removeSuggestion('milk');
    });

    expect(second).toBeNull();
    expect(sectionsIn(cache).popular).toEqual(['bread']);
  });

  it('does nothing when the suggestions were never loaded', () => {
    const cache = makeCache();
    const result = renderAddToPantry(cache);

    let removal: ReturnType<typeof result.current.removeSuggestion> = null;
    act(() => {
      removal = result.current.removeSuggestion('milk');
      result.current.restoreSuggestion(removal);
    });

    expect(removal).toBeNull();
    expect(sectionsIn(cache).popular).toBeUndefined();
  });
});
