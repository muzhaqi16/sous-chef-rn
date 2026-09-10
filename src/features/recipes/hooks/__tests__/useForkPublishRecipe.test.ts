import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  ForkRecipeDocument,
  UpdateRecipeDocument,
} from '#features/recipes/graphql/recipe.generated';
import { RecipeForm_RecipeFragmentDoc } from '#features/recipes/screens/RecipeForm/RecipeForm.generated';
import { useForkRecipe } from '../useForkRecipe';
import { usePublishRecipe } from '../usePublishRecipe';
import { useStore } from '#store';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/services/toastService', () => ({
  toastService: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const SOURCE = {
  __typename: 'Recipe',
  id: 'recipe-1',
  name: 'Lasagna',
  description: 'Layered',
  imageUrl: null,
  servings: 6,
  prepTimeMinutes: 20,
  cookTimeMinutes: 45,
  caloriesPerServing: null,
  difficulty: 'MEDIUM',
  category: 'DINNER',
  cuisine: 'Italian',
  status: 'PUBLISHED',
  diets: [],
  healthGoals: [],
  intolerances: [],
  notes: null,
  tips: null,
  originalAuthor: 'Nonna',
  tags: [],
  instructions: [{ step: 1, text: 'Layer' }],
  ingredientsConnection: {
    __typename: 'RecipeIngredientConnection',
    edges: [
      {
        __typename: 'RecipeIngredientEdge',
        node: {
          __typename: 'RecipeIngredient',
          id: 'ri-1',
          name: 'Tomatoes',
          quantity: 800,
          item: {
            __typename: 'Item',
            id: 'item-1',
            name: 'Tomatoes',
            imageUrl: null,
          },
          unit: {
            __typename: 'Unit',
            id: 'unit-1',
            name: 'gram',
            symbol: 'g',
          },
          image: null,
          isOptional: false,
          notes: null,
          preparation: null,
          sortOrder: 0,
          section: null,
        },
      },
    ],
  },
};

const seedSource = () =>
  seedCache([
    {
      data: SOURCE,
      fragment: RecipeForm_RecipeFragmentDoc,
      fragmentName: 'RecipeForm_recipe',
    },
  ]);

describe('useForkRecipe', () => {
  const USER = {
    id: 'user-1',
    email: 'tani@example.com',
    emailVerified: true,
    onBoarded: true,
  };

  beforeEach(() => {
    useStore.setState({ user: USER, apiReachable: false, isOnline: false });
  });

  afterEach(() => {
    useStore.setState({ user: null, apiReachable: true, isOnline: true });
    jest.clearAllMocks();
  });

  it('sends the minted id as newRecipeId and shows the copy, with the API unreachable', async () => {
    // Queued: the offline queue answers with a null payload.
    const fork = recordMock(ForkRecipeDocument, { data: { forkRecipe: null } });
    const cache = seedSource();
    const { result } = renderHookWithApollo(() => useForkRecipe(), {
      cache,
      operationMocks: [fork.mock],
    });

    let id: string | null = null;
    await act(async () => {
      id = await result.current.forkRecipe('recipe-1');
    });

    expect(id).toBeTruthy();
    // The source is forked FROM `id`; the row it creates is named separately,
    // which is what makes a replay converge instead of forking twice.
    expect(fork.fired[0]).toEqual({
      input: { id: 'recipe-1', newRecipeId: id },
    });

    // The copy is readable before any server answer.
    expect(cache.extract()[`Recipe:${id!}`]).toBeDefined();
  });

  it('refuses when the source recipe is not cached, without firing', async () => {
    const fork = recordMock(ForkRecipeDocument, { data: { forkRecipe: null } });
    const { result } = renderHookWithApollo(() => useForkRecipe(), {
      operationMocks: [fork.mock],
    });

    let id: string | null = 'unset';
    await act(async () => {
      id = await result.current.forkRecipe('recipe-1');
    });

    expect(id).toBeNull();
    expect(fork.fired).toHaveLength(0);
  });

  it('returns null and drops the copy when the fork is rejected', async () => {
    const cache = seedSource();
    const { result } = renderHookWithApollo(() => useForkRecipe(), {
      cache,
      operationMocks: [
        {
          request: { query: ForkRecipeDocument, variables: () => true },
          result: {
            data: {
              forkRecipe: {
                __typename: 'ForbiddenError',
                code: 'FORBIDDEN',
                message: 'nope',
              },
            },
          },
        },
      ],
    });

    let id: string | null = 'unset';
    await act(async () => {
      id = await result.current.forkRecipe('recipe-1');
    });
    expect(id).toBeNull();
    const forked = Object.keys(cache.extract()).filter(
      key => key.startsWith('Recipe:') && key !== 'Recipe:recipe-1',
    );
    expect(forked).toEqual([]);
  });
});

describe('usePublishRecipe', () => {
  it('returns true when the publish is queued offline', async () => {
    const { result } = renderHookWithApollo(() => usePublishRecipe(), {
      operationMocks: [
        {
          request: { query: UpdateRecipeDocument, variables: () => true },
          result: { data: { updateRecipe: null } }, // queued signature
        },
      ],
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setPublished('recipe-1', true);
    });
    expect(ok).toBe(true);
  });

  it('returns false when the update is rejected', async () => {
    const { result } = renderHookWithApollo(() => usePublishRecipe(), {
      operationMocks: [
        {
          request: { query: UpdateRecipeDocument, variables: () => true },
          result: {
            data: {
              updateRecipe: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message: 'bad',
                field: 'status',
              },
            },
          },
        },
      ],
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setPublished('recipe-1', false);
    });
    expect(ok).toBe(false);
  });
});
