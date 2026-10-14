import { makeCache } from '#/apollo/cache';
import {
  RecipeSuggestionsDocument,
  type RecipeSuggestionsQuery,
} from '#features/recipes/hooks/useServerRecipeSuggestions.generated';

const ranking = (...ids: string[]): RecipeSuggestionsQuery => ({
  __typename: 'Query',
  recipeSuggestions: {
    __typename: 'RecipeSuggestionConnection',
    edges: ids.map(id => ({
      __typename: 'RecipeSuggestionEdge',
      coverage: 50,
      expiringStacks: [],
      node: {
        __typename: 'Recipe',
        id,
        name: id,
        imageUrl: null,
        servings: 2,
        totalTimeMinutes: null,
      },
    })),
  },
});

const idsIn = (data: RecipeSuggestionsQuery | null) =>
  data?.recipeSuggestions.edges.map(edge => edge.node.id);

describe('Query.recipeSuggestions', () => {
  it('replaces a ranking with the next one for the same day, never merging', () => {
    const cache = makeCache();
    const variables = { first: 20, today: '2026-10-14' };

    cache.writeQuery({
      query: RecipeSuggestionsDocument,
      variables,
      data: ranking('a', 'b'),
    });
    cache.writeQuery({
      query: RecipeSuggestionsDocument,
      variables,
      data: ranking('c'),
    });

    expect(
      idsIn(cache.readQuery({ query: RecipeSuggestionsDocument, variables })),
    ).toEqual(['c']);
  });

  it('keeps a ranking per day', () => {
    const cache = makeCache();
    cache.writeQuery({
      query: RecipeSuggestionsDocument,
      variables: { first: 20, today: '2026-10-14' },
      data: ranking('today'),
    });
    cache.writeQuery({
      query: RecipeSuggestionsDocument,
      variables: { first: 20, today: '2026-10-15' },
      data: ranking('tomorrow'),
    });

    expect(
      idsIn(
        cache.readQuery({
          query: RecipeSuggestionsDocument,
          variables: { first: 20, today: '2026-10-14' },
        }),
      ),
    ).toEqual(['today']);
  });
});
