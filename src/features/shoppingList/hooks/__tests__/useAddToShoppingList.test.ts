import { act } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { makeCache } from '#/apollo/cache';
import {
  GetShoppingListSuggestionsDocument,
  type GetShoppingListSuggestionsQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useAddToShoppingList } from '../useAddToShoppingList';

const VARIABLES = { id: 'list-1', limit: 20 };

type Sections = NonNullable<
  GetShoppingListSuggestionsQuery['shoppingList']
>['suggestions'];

const row = (itemId: string): Sections['popular'][number] => ({
  __typename: 'ShoppingListSuggestion',
  id: `sug-${itemId}`,
  itemId,
  name: itemId,
  category: null,
  imageUrl: null,
  defaultUnitId: null,
});

/** Each section's item ids, in order. */
interface Layout {
  frequentlyAdded?: string[];
  popular?: string[];
}

const buildData = ({
  frequentlyAdded = [],
  popular = [],
}: Layout): GetShoppingListSuggestionsQuery => ({
  __typename: 'Query',
  shoppingList: {
    __typename: 'ShoppingList',
    id: 'list-1',
    suggestions: {
      __typename: 'ShoppingListSuggestions',
      recentlyDeleted: [],
      frequentlyAdded: frequentlyAdded.map(row),
      popular: popular.map(row),
    },
  },
});

const seed = (layout: Layout) => {
  const cache = makeCache();
  cache.writeQuery({
    query: GetShoppingListSuggestionsDocument,
    variables: VARIABLES,
    data: buildData(layout),
  });
  return cache;
};

const sectionsIn = (cache: ReturnType<typeof makeCache>) => {
  const sections = cache.readQuery({
    query: GetShoppingListSuggestionsDocument,
    variables: VARIABLES,
  })?.shoppingList?.suggestions;
  return {
    frequentlyAdded: sections?.frequentlyAdded.map(s => s.itemId),
    popular: sections?.popular.map(s => s.itemId),
  };
};

const renderAddToList = (cache: ReturnType<typeof makeCache>) =>
  renderHookWithApollo(
    () =>
      useAddToShoppingList({ shoppingListId: 'list-1', suggestionsLimit: 20 }),
    { cache },
  ).result;

describe('useAddToShoppingList suggestion removal', () => {
  it('takes the item from every section that holds it', () => {
    const cache = seed({
      frequentlyAdded: ['milk', 'eggs'],
      popular: ['bread', 'milk'],
    });
    const result = renderAddToList(cache);

    act(() => {
      result.current.removeSuggestion('milk');
    });

    expect(sectionsIn(cache)).toEqual({
      frequentlyAdded: ['eggs'],
      popular: ['bread'],
    });
  });

  it('puts the item back at its old place in each section', () => {
    const cache = seed({
      frequentlyAdded: ['milk', 'eggs'],
      popular: ['bread', 'milk'],
    });
    const result = renderAddToList(cache);

    act(() => {
      result.current.restoreSuggestion(result.current.removeSuggestion('milk'));
    });

    expect(sectionsIn(cache)).toEqual({
      frequentlyAdded: ['milk', 'eggs'],
      popular: ['bread', 'milk'],
    });
  });

  // Another suggestion left meanwhile: the restored one goes to the end.
  it('restores into a section that has since shrunk', () => {
    const cache = seed({ popular: ['bread', 'eggs', 'milk'] });
    const result = renderAddToList(cache);

    act(() => {
      const milk = result.current.removeSuggestion('milk');
      result.current.removeSuggestion('eggs');
      result.current.restoreSuggestion(milk);
    });

    expect(sectionsIn(cache).popular).toEqual(['bread', 'milk']);
  });

  it('restores once however often it is asked', () => {
    const cache = seed({ popular: ['bread', 'milk'] });
    const result = renderAddToList(cache);

    act(() => {
      const milk = result.current.removeSuggestion('milk');
      result.current.restoreSuggestion(milk);
      result.current.restoreSuggestion(milk);
    });

    expect(sectionsIn(cache).popular).toEqual(['bread', 'milk']);
  });

  it('takes nothing a second time', () => {
    const cache = seed({ popular: ['bread', 'milk'] });
    const result = renderAddToList(cache);

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
    const result = renderAddToList(cache);

    let removal: ReturnType<typeof result.current.removeSuggestion> = null;
    act(() => {
      removal = result.current.removeSuggestion('milk');
      result.current.restoreSuggestion(removal);
    });

    expect(removal).toBeNull();
    expect(sectionsIn(cache).popular).toBeUndefined();
  });
});
