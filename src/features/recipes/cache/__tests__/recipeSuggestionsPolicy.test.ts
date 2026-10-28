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

  it('keeps a ranking per home, and one for no home', () => {
    const cache = makeCache();
    const forHome = (homeId?: string) => ({
      first: 20,
      today: '2026-10-14',
      homeId,
    });
    cache.writeQuery({
      query: RecipeSuggestionsDocument,
      variables: forHome('home-a'),
      data: ranking('a'),
    });
    cache.writeQuery({
      query: RecipeSuggestionsDocument,
      variables: forHome('home-b'),
      data: ranking('b'),
    });
    cache.writeQuery({
      query: RecipeSuggestionsDocument,
      variables: forHome(),
      data: ranking('every'),
    });

    const read = (homeId?: string) =>
      idsIn(
        cache.readQuery({
          query: RecipeSuggestionsDocument,
          variables: forHome(homeId),
        }),
      );
    expect(read('home-a')).toEqual(['a']);
    expect(read('home-b')).toEqual(['b']);
    expect(read()).toEqual(['every']);
  });

  it("answers nothing for a home it has no ranking for, not another home's", () => {
    const cache = makeCache();
    cache.writeQuery({
      query: RecipeSuggestionsDocument,
      variables: { first: 20, today: '2026-10-14', homeId: 'home-a' },
      data: ranking('a'),
    });

    expect(
      cache.readQuery({
        query: RecipeSuggestionsDocument,
        variables: { first: 20, today: '2026-10-14', homeId: 'home-b' },
      }),
    ).toBeNull();
  });
});
