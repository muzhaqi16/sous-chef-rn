import { waitFor } from '@testing-library/react-native';
import type { Unmasked } from '@apollo/client/masking';
import { t } from '#/i18n';
import {
  completeMockedResponse,
  recordMock,
  renderHookWithApollo,
  seedCache,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import {
  GetRecipeDocument,
  type GetRecipeQuery,
} from '#features/recipes/graphql/recipe.generated';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import {
  DietaryAlertState,
  MembershipRole,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { RecipeSubstitutesDocument } from '../useRecipeSubstitutes.generated';
import { useRecipeSubstitutes } from '../useRecipeSubstitutes';

let mockHomeId: string | null = 'home-1';
jest.mock('#store/useAppStore', () => ({
  useSelectedHomeId: () => mockHomeId,
  useSelectedPantryId: () => 'pantry-1',
  useUser: () => ({ id: 'u-me' }),
}));

const CUP = { id: 'u-cup', symbol: 'cup' };
const TBSP = { id: 'u-tbsp', symbol: 'tbsp' };
const part = (
  id: string,
  name: string,
  quantity: number,
  unit: typeof CUP,
  inPantry: boolean,
) => ({ quantity, unit, inPantry, item: { id, name } });

const DAIRY_NOTE = {
  state: DietaryAlertState.Contains,
  membership: {
    id: 'm-me',
    userId: 'u-me',
    role: MembershipRole.Owner,
    displayName: 'John',
  },
  restriction: {
    id: 'r-dairy',
    diet: null,
    intolerance: null,
    healthGoal: null,
    item: { id: 'yogurt', name: 'yogurt' },
    severity: RestrictionSeverity.Preference,
  },
};

const option = (
  id: string,
  parts: ReturnType<typeof part>[],
  extra: {
    scaled?: boolean;
    note?: string | null;
    alerts?: (typeof DAIRY_NOTE)[];
  } = {},
) => ({
  substitute: {
    id,
    note: extra.note ?? null,
    forQuantity: 1,
    forUnit: CUP,
  },
  scaled: extra.scaled ?? true,
  parts,
  alerts: extra.alerts ?? [],
});

const MILK_LEMON = option('s-milk-lemon', [
  part('milk', 'milk', 1, CUP, true),
  part('lemon', 'lemon juice', 1, TBSP, true),
]);
const YOGURT_MILK = option(
  's-yogurt',
  [
    part('yogurt', 'plain yogurt', 0.75, CUP, false),
    part('milk', 'milk', 0.25, CUP, true),
  ],
  {
    scaled: false,
    note: 'Thicker; thin with milk.',
    alerts: [DAIRY_NOTE],
  },
);

const substitutesMock = () =>
  recordMock(RecipeSubstitutesDocument, {
    data: {
      recipe: {
        id: 'recipe-1',
        ingredientsConnection: {
          edges: [
            {
              node: {
                id: 'buttermilk',
                substitutes: [MILK_LEMON, YOGURT_MILK],
              },
            },
            { node: { id: 'flour', substitutes: [] } },
          ],
          pageInfo: { hasNextPage: false, endCursor: 'c-2' },
          totalCount: 2,
        },
      },
    },
  });

describe('useRecipeSubstitutes', () => {
  beforeEach(() => {
    mockHomeId = 'home-1';
  });

  it('words each swap: parts in the recipe amount, what the pantry holds, note and notes', async () => {
    const mock = substitutesMock();
    const { result } = renderHookWithApollo(
      () => useRecipeSubstitutes('recipe-1', true),
      { operationMocks: [mock.mock] },
    );

    await waitFor(() =>
      expect(result.current.substitutesFor('buttermilk')).toHaveLength(2),
    );
    expect(mock.fired[0]).toMatchObject({
      homeId: 'home-1',
      pantryId: 'pantry-1',
    });
    const [milkLemon, yogurt] = result.current.substitutesFor('buttermilk');
    expect(milkLemon).toEqual({
      id: 's-milk-lemon',
      parts: [
        {
          key: 'milk',
          text: t('recipes.substitutes.part', {
            amount: '1 cup',
            name: 'milk',
          }),
          inPantry: true,
        },
        {
          key: 'lemon',
          text: t('recipes.substitutes.part', {
            amount: '1 tbsp',
            name: 'lemon juice',
          }),
          inPantry: true,
        },
      ],
      stock: 'all',
      per: null,
      note: null,
      alerts: [],
    });
    expect(yogurt).toMatchObject({
      stock: 'some',
      per: '1 cup',
      note: 'Thicker; thin with milk.',
      alerts: [expect.objectContaining({ id: 'r-dairy', memberName: 'You' })],
    });
    expect(result.current.substitutesFor('flour')).toEqual([]);
  });

  it('asks for nothing while no row is flagged', () => {
    const mock = substitutesMock();
    const { result } = renderHookWithApollo(
      () => useRecipeSubstitutes('recipe-1', false),
      { operationMocks: [mock.mock] },
    );

    expect(mock.fired).toHaveLength(0);
    expect(result.current.substitutesFor('buttermilk')).toEqual([]);
  });

  // A skipped query keeps its last answer, which is another household's.
  it('offers no swaps once the home is left', async () => {
    const { result, rerender } = renderHookWithApollo(
      () => useRecipeSubstitutes('recipe-1', true),
      { operationMocks: [substitutesMock().mock] },
    );
    await waitFor(() =>
      expect(result.current.substitutesFor('buttermilk')).toHaveLength(2),
    );

    mockHomeId = null;
    rerender({});

    expect(result.current.substitutesFor('buttermilk')).toEqual([]);
  });

  it('offers no swaps once no row is flagged', async () => {
    const { result, rerender } = renderHookWithApollo(
      ({ wanted }: { wanted: boolean }) =>
        useRecipeSubstitutes('recipe-1', wanted),
      {
        operationMocks: [substitutesMock().mock],
        initialProps: { wanted: true },
      },
    );
    await waitFor(() =>
      expect(result.current.substitutesFor('buttermilk')).toHaveLength(2),
    );

    rerender({ wanted: false });

    expect(result.current.substitutesFor('buttermilk')).toEqual([]);
  });

  // Both queries cache the recipe's `ingredientsConnection`, whose first page a
  // write replaces: this one's write must leave the recipe's own read whole.
  it('leaves the recipe readable once its swaps land', async () => {
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
              edges: ['buttermilk', 'flour'].map(id => ({
                __typename: 'RecipeIngredientEdge',
                node: { __typename: 'RecipeIngredient', id },
              })),
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: 'c-2',
              },
              totalCount: 2,
            },
          },
        },
      },
    }).result as (vars: typeof recipeVars) => {
      data: Unmasked<GetRecipeQuery>;
    };
    const cache = seedCache([]);
    seedQuery(cache, {
      query: GetRecipeDocument,
      variables: recipeVars,
      data: completed(recipeVars).data,
    });

    const { result } = renderHookWithApollo(
      () => useRecipeSubstitutes('recipe-1', true),
      { cache, operationMocks: [substitutesMock().mock] },
    );
    await waitFor(() =>
      expect(result.current.substitutesFor('buttermilk')).toHaveLength(2),
    );

    const recipe = cache.readQuery({
      query: GetRecipeDocument,
      variables: recipeVars,
    });
    expect(recipe?.recipe?.id).toBe('recipe-1');
    expect(recipe?.recipe?.ingredientsConnection.edges).toHaveLength(2);
  });
});
