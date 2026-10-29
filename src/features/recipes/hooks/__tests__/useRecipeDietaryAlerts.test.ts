import { waitFor } from '@testing-library/react-native';
import type { Unmasked } from '@apollo/client/masking';
import {
  completeMockedResponse,
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  GetRecipeDocument,
  type GetRecipeQuery,
} from '#features/recipes/graphql/recipe.generated';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import {
  DietaryAlertState,
  Intolerance,
  MembershipRole,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { RecipeDietaryAlertsDocument } from '../useRecipeDietaryAlerts.generated';
import { useRecipeDietaryAlerts } from '../useRecipeDietaryAlerts';

let mockHomeId: string | null = 'home-1';
jest.mock('#store/useAppStore', () => ({
  useSelectedHomeId: () => mockHomeId,
  useUser: () => ({ id: 'u-me' }),
}));
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: () => false,
}));
let mockRestrictionsInPlay: boolean | null = true;
jest.mock('#features/profile/hooks/useRestrictionsInPlay', () => ({
  useRestrictionsInPlay: () => mockRestrictionsInPlay,
}));

const TANI = {
  id: 'm-tani',
  userId: 'u-tani',
  role: MembershipRole.Member,
  displayName: 'Tani',
};
const ME = {
  id: 'm-me',
  userId: 'u-me',
  role: MembershipRole.Owner,
  displayName: 'John',
};
const PEANUT = {
  id: 'r-peanut',
  diet: null,
  intolerance: Intolerance.Peanut,
  healthGoal: null,
  item: null,
  severity: RestrictionSeverity.Allergy,
};
const BACON = {
  id: 'r-bacon',
  diet: null,
  intolerance: null,
  healthGoal: null,
  item: { id: 'bacon', name: 'bacon' },
  severity: RestrictionSeverity.Preference,
};

const row = (
  id: string,
  alerts: {
    state: DietaryAlertState;
    membership: typeof TANI;
    restriction: typeof PEANUT | typeof BACON;
  }[],
) => ({ node: { id, dietaryAlerts: alerts } });

const alertsMock = () =>
  recordMock(RecipeDietaryAlertsDocument, {
    data: {
      recipe: {
        id: 'recipe-1',
        ingredientsConnection: {
          edges: [
            row('bacon-row', [
              {
                state: DietaryAlertState.Contains,
                membership: ME,
                restriction: BACON,
              },
            ]),
            row('sauce-row', [
              {
                state: DietaryAlertState.MayContain,
                membership: TANI,
                restriction: PEANUT,
              },
            ]),
            row('satay-row', [
              {
                state: DietaryAlertState.Contains,
                membership: TANI,
                restriction: PEANUT,
              },
            ]),
            row('rice-row', []),
          ],
          pageInfo: { hasNextPage: false, endCursor: 'c-4' },
          totalCount: 4,
        },
      },
    },
  });

const cleanRecipeMock = () =>
  recordMock(RecipeDietaryAlertsDocument, {
    data: {
      recipe: {
        id: 'recipe-1',
        ingredientsConnection: {
          edges: [row('rice-row', [])],
          pageInfo: { hasNextPage: false, endCursor: 'c-1' },
          totalCount: 1,
        },
      },
    },
  });

beforeEach(() => {
  mockHomeId = 'home-1';
  mockRestrictionsInPlay = true;
});

describe('useRecipeDietaryAlerts', () => {
  it('flags each row, and sums each restriction once, strongest and strictest first', async () => {
    const { result } = renderHookWithApollo(
      () => useRecipeDietaryAlerts('recipe-1'),
      { operationMocks: [alertsMock().mock] },
    );

    await waitFor(() => expect(result.current.check).toBe('checked'));
    expect(
      result.current.summary.map(alert => [alert.id, alert.state]),
    ).toEqual([
      ['r-peanut', DietaryAlertState.Contains],
      ['r-bacon', DietaryAlertState.Contains],
    ]);
    expect(result.current.alertsFor('sauce-row')).toEqual([
      expect.objectContaining({
        memberName: 'Tani',
        state: DietaryAlertState.MayContain,
      }),
    ]);
    expect(result.current.alertsFor('rice-row')).toEqual([]);
  });

  // Under `errorPolicy: 'all'` an answer that comes with errors keeps its data
  // (a network failure drops it): never shown as a clean check.
  it('shows an answer that came with errors as possibly out of date', async () => {
    const answered = alertsMock().mock;
    const withErrors: typeof answered = {
      ...answered,
      result: {
        ...(answered.result as { data: Record<string, unknown> }),
        errors: [{ message: 'restrictions unavailable' }],
      },
    };
    const { result } = renderHookWithApollo(
      () => useRecipeDietaryAlerts('recipe-1'),
      { operationMocks: [withErrors] },
    );

    await waitFor(() => expect(result.current.check).toBe('stale'));
    expect(result.current.summary).toHaveLength(2);
  });

  it('checks nothing without a home', () => {
    mockHomeId = null;
    const { result } = renderHookWithApollo(
      () => useRecipeDietaryAlerts('recipe-1'),
      { operationMocks: [] },
    );

    expect(result.current.check).toBe('none');
    expect(result.current.summary).toEqual([]);
  });

  // Both queries cache the recipe's `ingredientsConnection`, whose first page a
  // write replaces: the alerts' write must leave the recipe's own read whole,
  // or the page falls to "not found".
  it('leaves the recipe readable once its alerts land', async () => {
    const recipeVars = {
      id: 'recipe-1',
      ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
    };
    const completed = completeMockedResponse({
      request: { query: GetRecipeDocument, variables: recipeVars },
      result: {
        data: {
          recipe: {
            __typename: 'Recipe',
            id: 'recipe-1',
            ingredientsConnection: {
              __typename: 'RecipeIngredientConnection',
              edges: ['bacon-row', 'sauce-row', 'satay-row', 'rice-row'].map(
                id => ({
                  __typename: 'RecipeIngredientEdge',
                  node: { __typename: 'RecipeIngredient', id },
                }),
              ),
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: 'c-4',
              },
              totalCount: 4,
            },
          },
        },
      },
    }).result as (vars: typeof recipeVars) => {
      data: Unmasked<GetRecipeQuery>;
    };
    const cache = seedCache([]);
    cache.writeQuery({
      query: GetRecipeDocument,
      variables: recipeVars,
      data: completed(recipeVars).data,
    });

    const { result } = renderHookWithApollo(
      () => useRecipeDietaryAlerts('recipe-1'),
      { cache, operationMocks: [alertsMock().mock] },
    );
    await waitFor(() => expect(result.current.check).toBe('checked'));

    const recipe = cache.readQuery({
      query: GetRecipeDocument,
      variables: recipeVars,
    });
    expect(recipe?.recipe?.id).toBe('recipe-1');
    expect(recipe?.recipe?.ingredientsConnection.totalCount).toBe(4);
    expect(recipe?.recipe?.ingredientsConnection.edges).toHaveLength(4);
  });

  describe('the label caveat', () => {
    const answeredWith = async (
      mock: ReturnType<typeof recordMock>,
      inPlay: boolean | null,
    ) => {
      mockRestrictionsInPlay = inPlay;
      const { result } = renderHookWithApollo(
        () => useRecipeDietaryAlerts('recipe-1'),
        { operationMocks: [mock.mock] },
      );
      await waitFor(() => expect(result.current.check).toBe('checked'));
      return result.current;
    };

    it('shows beside a flagged ingredient', async () => {
      expect((await answeredWith(alertsMock(), false)).caveat).toBe(true);
    });

    it('shows on a recipe with no flagged ingredient while a restriction is in play', async () => {
      expect((await answeredWith(cleanRecipeMock(), true)).caveat).toBe(true);
    });

    it('shows while it is not yet known whether a restriction is in play', async () => {
      expect((await answeredWith(cleanRecipeMock(), null)).caveat).toBe(true);
    });

    it('is absent when no restriction anywhere can alert', async () => {
      expect((await answeredWith(cleanRecipeMock(), false)).caveat).toBe(
        false,
      );
    });

    it('is absent before the check answers and without a home', () => {
      const loading = renderHookWithApollo(
        () => useRecipeDietaryAlerts('recipe-1'),
        { operationMocks: [cleanRecipeMock().mock] },
      );
      expect(loading.result.current.check).toBe('loading');
      expect(loading.result.current.caveat).toBe(false);

      mockHomeId = null;
      const noHome = renderHookWithApollo(
        () => useRecipeDietaryAlerts('recipe-1'),
        { operationMocks: [] },
      );
      expect(noHome.result.current.caveat).toBe(false);
    });
  });
});
