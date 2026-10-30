import { waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { RecipeSuggestionsDocument } from '#features/recipes/hooks/useServerRecipeSuggestions.generated';
import { useStore } from '#store';
import { useRecipePayoff } from '../useRecipePayoff';

jest.mock('#hooks/app/useToday', () => ({
  useToday: () => '2026-10-29',
}));

let mockFlagOn = true;
jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: () => mockFlagOn,
}));

// Its own reads are tested in profile; this pins what the payoff makes of it.
let mockRestrictionsInPlay: boolean | null = false;
jest.mock('#features/profile/hooks/useRestrictionsInPlay', () => ({
  useRestrictionsInPlay: () => mockRestrictionsInPlay,
}));

type Edge = NonNullable<
  NonNullable<
    NonNullable<
      MockDataFor<typeof RecipeSuggestionsDocument>['recipeSuggestions']
    >['edges']
  >[number]
>;

const edge = (id: string, coverage = 50): Edge => ({
  coverage,
  expiringStacks: [],
  node: { id },
});

/** The server's screened ranking: what it judged free of dietary alerts. */
const screenedRanking = (edges: Edge[]) =>
  recordMock(RecipeSuggestionsDocument, {
    data: { recipeSuggestions: { edges } },
    match: vars => vars.excludeDietaryConflicts === true,
  });

const ids = (rows: { edge: { node: { id: string } } }[]) =>
  rows.map(row => row.edge.node.id);

const renderPayoff = (edges: Edge[], cache = makeCache()) => {
  const screened = screenedRanking(edges);
  // Every recipe any render showed, so a flash of a cached answer counts too.
  const everShown = new Set<string>();
  const rendered = renderHookWithApollo(
    () => {
      const payoff = useRecipePayoff();
      ids(payoff.rows).forEach(id => everShown.add(id));
      return payoff;
    },
    { cache, operationMocks: [screened.mock] },
  );
  return { ...rendered, screened, everShown };
};

beforeEach(() => {
  mockFlagOn = true;
  mockRestrictionsInPlay = false;
  useStore.setState({ selectedHomeId: 'home-1' });
});

afterEach(() => useStore.setState({ selectedHomeId: null }));

describe('useRecipePayoff', () => {
  it('eggs in the pantry, peanuts avoided: shows the screened egg recipes, never the unscreened ranking', async () => {
    // The Recipes tab's unscreened ranking, already cached for the same day and home.
    const cache = makeCache();
    seedQuery(cache, {
      query: RecipeSuggestionsDocument,
      variables: { first: 20, today: '2026-10-29', homeId: 'home-1' },
      data: {
        __typename: 'Query',
        recipeSuggestions: {
          __typename: 'RecipeSuggestionConnection',
          edges: [
            {
              __typename: 'RecipeSuggestionEdge',
              coverage: 90,
              expiringStacks: [],
              node: {
                __typename: 'Recipe',
                version: 1,
                id: 'peanut-noodles',
                name: 'Peanut noodles',
                imageUrl: null,
                servings: 2,
                totalTimeMinutes: 20,
              },
            },
          ],
        },
      },
    });

    const { result, screened, everShown } = renderPayoff(
      [edge('shakshuka', 80), edge('frittata', 60)],
      cache,
    );

    await waitFor(() =>
      expect(ids(result.current.rows)).toEqual(['shakshuka', 'frittata']),
    );
    expect(everShown.has('peanut-noodles')).toBe(false);
    expect(screened.fired).toEqual([
      {
        first: 20,
        today: '2026-10-29',
        homeId: 'home-1',
        excludeDietaryConflicts: true,
      },
    ]);
  });

  it('shows up to three', async () => {
    const { result } = renderPayoff(['a', 'b', 'c', 'd'].map(id => edge(id)));

    await waitFor(() =>
      expect(ids(result.current.rows)).toEqual(['a', 'b', 'c']),
    );
  });

  it('leaves out a recipe the pantry holds nothing of', async () => {
    const { result } = renderPayoff([edge('a', 0), edge('b', 40)]);

    await waitFor(() => expect(ids(result.current.rows)).toEqual(['b']));
  });

  it('shows none with no candidate', async () => {
    const { result, screened } = renderPayoff([]);

    await waitFor(() => expect(screened.fired).toHaveLength(1));
    expect(result.current.rows).toEqual([]);
  });

  it('says to check the label when a restriction applies, or none is known yet', async () => {
    mockRestrictionsInPlay = true;
    const { result, rerender } = renderPayoff([edge('a')]);
    await waitFor(() => expect(ids(result.current.rows)).toEqual(['a']));
    expect(result.current.showCheckLabel).toBe(true);

    mockRestrictionsInPlay = null;
    rerender({});
    expect(result.current.showCheckLabel).toBe(true);
  });

  it('shows no label caveat when no restriction applies', async () => {
    const { result } = renderPayoff([edge('a')]);

    await waitFor(() => expect(ids(result.current.rows)).toEqual(['a']));
    expect(result.current.showCheckLabel).toBe(false);
  });

  it('asks for nothing with pantry suggestions off', () => {
    mockFlagOn = false;
    const { result, screened } = renderPayoff([edge('a')]);

    expect(result.current.rows).toEqual([]);
    expect(screened.fired).toEqual([]);
  });
});
