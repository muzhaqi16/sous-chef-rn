import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  type SeedWithFragment,
} from '#/test-utils/apolloMockProvider';
import {
  ForkRecipeDocument,
  UpdateRecipeDocument,
} from '#features/recipes/graphql/recipe.generated';
import { UseRecipeFormWrites_RecipeFragmentDoc } from '#features/recipes/hooks/useRecipeFormWrites.generated';
import { useForkRecipe } from '../useForkRecipe';
import { usePublishRecipe } from '../usePublishRecipe';
import { useStore } from '#store';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { ErrorCode, RecipeStatus } from '#/graphql/generated/schemaTypes';
import {
  MAX_RECIPE_INGREDIENTS,
  RECIPE_INGREDIENTS_PAGE_SIZE,
} from '#domain/recipeIngredientsPaging';
import { t } from '#/i18n';
import {
  recipeFormFragment,
  recipeFormIngredient,
} from '#/test-utils/fixtures/recipeFixtures';

/** The recipe forked and published: one ingredient, all of it on the device. */
const sourceRecipe = (fixture: Parameters<typeof recipeFormFragment>[0] = {}) =>
  recipeFormFragment({
    status: RecipeStatus.Published,
    ingredients: [recipeFormIngredient({ id: 'ri-1', name: 'Tomatoes' })],
    ...fixture,
  });

const SOURCE = sourceRecipe();

const seedSource = (source: SeedWithFragment['data'] = SOURCE) =>
  seedCache([
    {
      data: source,
      fragment: UseRecipeFormWrites_RecipeFragmentDoc,
      fragmentName: 'useRecipeFormWrites_recipe',
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

  // The device writes the copy as a whole recipe, and holds only the first
  // page of one over the limit: its copy would show, and later save, a short
  // ingredient list.
  it('refuses a source over the ingredient limit, without firing', async () => {
    const fork = recordMock(ForkRecipeDocument, { data: { forkRecipe: null } });
    const cache = seedSource(
      sourceRecipe({
        ingredientsPage: {
          totalCount: 150,
          hasNextPage: true,
          endCursor: 'cursor-100',
        },
      }),
    );
    const { result } = renderHookWithApollo(() => useForkRecipe(), {
      cache,
      operationMocks: [fork.mock],
    });

    let id: string | null = 'unset';
    await act(async () => {
      id = await result.current.forkRecipe('recipe-1');
    });

    expect(id).toBeNull();
    expect(fork.fired).toHaveLength(0);
    expect(toastService.error).toHaveBeenCalledTimes(1);
    expect(toastService.error).toHaveBeenCalledWith(
      t('recipes.ingredientsOverLimit', { count: MAX_RECIPE_INGREDIENTS }),
    );
    // No copy was written either.
    expect(
      Object.keys(cache.extract()).filter(
        key => key.startsWith('Recipe:') && key !== 'Recipe:recipe-1',
      ),
    ).toEqual([]);
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
                code: ErrorCode.Forbidden,
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
    // Reported once, in the app's words.
    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(alertService.alert).not.toHaveBeenCalledWith(
      expect.anything(),
      'nope',
    );
  });

  it('drops the copy and reports once when the fork throws', async () => {
    const cache = seedSource();
    const { result } = renderHookWithApollo(() => useForkRecipe(), {
      cache,
      operationMocks: [
        {
          request: { query: ForkRecipeDocument, variables: () => true },
          error: new Error('network down'),
        },
      ],
    });

    let id: string | null = 'unset';
    await act(async () => {
      id = await result.current.forkRecipe('recipe-1');
    });

    expect(id).toBeNull();
    expect(alertService.alert).toHaveBeenCalledTimes(1);
  });
});

describe('usePublishRecipe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // A submission lands in PENDING_REVIEW until a moderator approves, so the
  // cache must not claim the recipe is published while it waits.
  it('shows a submitted draft in review before the server answers', async () => {
    const cache = seedCache([
      {
        data: sourceRecipe({ status: RecipeStatus.Draft }),
        fragment: UseRecipeFormWrites_RecipeFragmentDoc,
        fragmentName: 'useRecipeFormWrites_recipe',
      },
    ]);
    const { result } = renderHookWithApollo(() => usePublishRecipe(), {
      cache,
      operationMocks: [
        {
          request: { query: UpdateRecipeDocument, variables: () => true },
          result: { data: { updateRecipe: null } }, // queued signature
        },
      ],
    });

    await act(async () => {
      await result.current.setSubmitted('recipe-1', true);
    });

    const recipe = cache.readFragment<{ status: string }>({
      id: cache.identify({ __typename: 'Recipe', id: 'recipe-1' }),
      fragment: UseRecipeFormWrites_RecipeFragmentDoc,
      fragmentName: 'useRecipeFormWrites_recipe',
    });
    expect(recipe?.status).toBe('PENDING_REVIEW');
  });

  it('states the cached version, and returns true when the submission is queued offline', async () => {
    const update = recordMock(UpdateRecipeDocument, {
      data: { updateRecipe: null }, // queued signature
    });
    const { result } = renderHookWithApollo(() => usePublishRecipe(), {
      cache: seedSource(),
      operationMocks: [update.mock],
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setSubmitted('recipe-1', true);
    });

    expect(ok).toBe(true);
    // The API refuses an edit that states no version.
    expect(update.fired).toEqual([
      {
        input: {
          id: 'recipe-1',
          status: RecipeStatus.Published,
          version: SOURCE.version,
        },
        ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
      },
    ]);
  });

  it('returns false and puts the status back when the update is rejected', async () => {
    const cache = seedSource();
    const update = recordMock(UpdateRecipeDocument, {
      data: {
        updateRecipe: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          field: 'status',
        },
      },
    });
    const { result } = renderHookWithApollo(() => usePublishRecipe(), {
      cache,
      operationMocks: [update.mock],
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setSubmitted('recipe-1', false);
    });

    expect(ok).toBe(false);
    // The refusal, not an unsent write, is what failed it.
    expect(update.fired).toHaveLength(1);
    expect(alertService.alert).toHaveBeenCalledTimes(1);
    const recipe = cache.readFragment<{ status: string }>({
      id: cache.identify({ __typename: 'Recipe', id: 'recipe-1' }),
      fragment: UseRecipeFormWrites_RecipeFragmentDoc,
      fragmentName: 'useRecipeFormWrites_recipe',
    });
    expect(recipe?.status).toBe(SOURCE.status);
  });

  it('does not send a status change for a recipe whose version it never read', async () => {
    const update = recordMock(UpdateRecipeDocument, {
      data: { updateRecipe: null },
    });
    const { result } = renderHookWithApollo(() => usePublishRecipe(), {
      operationMocks: [update.mock],
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setSubmitted('recipe-1', true);
    });

    expect(ok).toBe(false);
    expect(update.fired).toEqual([]);
    expect(alertService.alert).toHaveBeenCalledTimes(1);
  });
});
