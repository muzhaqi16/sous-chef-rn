import type { TypedDocumentNode } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  renderHookWithApollo,
  seedCache,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { drained, drainTimers } from '#/test-utils/drainTimers';
import {
  CreateMealTemplateDocument,
  UpdateMealTemplateDocument,
  AddTemplateItemDocument,
  GetMealTemplateForEditDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import { UseMealTemplateEditor_TemplateFragmentDoc } from '../useMealTemplateEditor.generated';
import { TemplateCategory, MealType } from '#/graphql/generated/schemaTypes';
import { useMealTemplateEditor } from '../useMealTemplateEditor';

const TEMPLATE = {
  __typename: 'MealTemplate',
  id: 'tpl-1',
  name: 'Weeknight Dinners',
  description: null,
  category: TemplateCategory.Weekly,
  defaultServings: 2,
  tags: [],
  updatedAt: '2026-01-01T00:00:00Z',
};

const readTemplate = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ name: string; category: TemplateCategory }>({
    id: cache.identify({ __typename: 'MealTemplate', id: 'tpl-1' }),
    fragment: UseMealTemplateEditor_TemplateFragmentDoc,
    fragmentName: 'useMealTemplateEditor_template',
  });

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useMealTemplateEditor', () => {
  it('createTemplate returns the minted id when the create is queued offline', async () => {
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      operationMocks: [
        {
          request: {
            query: CreateMealTemplateDocument,
            variables: () => true,
          },
          result: { data: { createMealTemplate: null } }, // queued signature
        },
      ],
    });

    let id: string | null = null;
    id = await drained(() =>
      result.current.createTemplate({
        name: 'New',
        category: TemplateCategory.Weekly,
        items: [],
      }),
    );
    expect(typeof id).toBe('string');
    expect(id).toBeTruthy();
  });

  it('createTemplate returns null on a rejection', async () => {
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      operationMocks: [
        {
          request: {
            query: CreateMealTemplateDocument,
            variables: () => true,
          },
          result: {
            data: {
              createMealTemplate: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message: 'bad',
                field: 'name',
              },
            },
          },
        },
      ],
    });

    let id: string | null = 'unset';
    id = await drained(() =>
      result.current.createTemplate({
        name: '',
        category: TemplateCategory.Weekly,
        items: [],
      }),
    );
    expect(id).toBeNull();
  });

  it('updateTemplate writes the change optimistically and keeps it when queued', async () => {
    const cache = seedCache([TEMPLATE]);
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdateMealTemplateDocument,
            variables: () => true,
          },
          result: { data: { updateMealTemplate: null } }, // queued
        },
      ],
    });

    let ok: boolean | undefined;
    await drained(async () => {
      const promise = result.current.updateTemplate('tpl-1', {
        name: 'Renamed',
      });
      expect(readTemplate(cache)?.name).toBe('Renamed');
      ok = await promise;
    });
    expect(ok).toBe(true);
    expect(readTemplate(cache)?.name).toBe('Renamed');
  });

  it('updateTemplate reverts and returns false on a rejection', async () => {
    const cache = seedCache([TEMPLATE]);
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdateMealTemplateDocument,
            variables: () => true,
          },
          result: {
            data: {
              updateMealTemplate: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message: 'nope',
                field: 'name',
              },
            },
          },
        },
      ],
    });

    let ok: boolean | undefined;
    ok = await drained(() =>
      result.current.updateTemplate('tpl-1', { name: 'Renamed' }),
    );
    expect(ok).toBe(false);
    await drainTimers();
    expect(readTemplate(cache)?.name).toBe('Weeknight Dinners');
  });

  it('addItem returns false on a rejection', async () => {
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      operationMocks: [
        {
          request: { query: AddTemplateItemDocument, variables: () => true },
          result: {
            data: {
              addTemplateItem: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message: 'nope',
                field: 'mealType',
              },
            },
          },
        },
      ],
    });

    let ok: boolean | undefined;
    ok = await drained(() =>
      result.current.addItem({
        templateId: 'tpl-1',
        dayOffset: 0,
        mealType: MealType.Breakfast,
        meal: { customMealName: 'Oats' },
        servings: 1,
      }),
    );
    expect(ok).toBe(false);
  });
});

describe('updateItem maps the @oneOf meal ref onto BOTH fields', () => {
  const {
    MealTemplateItemFragmentDoc,
  } = require('#features/mealPlan/graphql/mealPlanFragments.generated');
  const {
    UpdateTemplateItemDocument,
  } = require('#features/mealPlan/graphql/mealTemplate.generated');

  const RECIPE = {
    __typename: 'Recipe',
    version: 1,
    id: 'recipe-1',
    name: 'Carbonara',
    imageUrl: null,
    servings: 4,
    totalTimeMinutes: 25,
  };

  const RECIPE_BACKED_ITEM = {
    __typename: 'MealTemplateItem',
    id: 'item-1',
    dayOffset: 0,
    mealType: MealType.Dinner,
    customMealName: null,
    servings: 2,
    notes: null,
    recipe: RECIPE,
  };

  const CUSTOM_ITEM = {
    ...RECIPE_BACKED_ITEM,
    id: 'item-2',
    customMealName: 'Leftovers',
    recipe: null,
  };

  const readItem = (cache: ReturnType<typeof seedCache>, id: string) =>
    cache.readFragment({
      id: cache.identify({ __typename: 'MealTemplateItem', id }),
      fragment: MealTemplateItemFragmentDoc,
      fragmentName: 'MealTemplateItemFragment',
    });

  // Queued: no server response arrives, so whatever the local write left is
  // what the user sees — which is the whole point of the finding.
  const queuedUpdate = {
    request: { query: UpdateTemplateItemDocument, variables: () => true },
    result: { data: { updateTemplateItem: null } },
    maxUsageCount: Number.POSITIVE_INFINITY,
  };

  it('clears the recipe when the row becomes a custom meal', async () => {
    const cache = seedCache([RECIPE, RECIPE_BACKED_ITEM]);
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [queuedUpdate],
    });

    await drained(() =>
      result.current.updateItem({
        id: 'item-1',
        meal: { customMealName: 'Leftovers' },
      }),
    );

    const item = readItem(cache, 'item-1') as {
      customMealName: string | null;
      recipe: unknown;
    } | null;
    expect(item?.customMealName).toBe('Leftovers');
    // The recipe it replaced must not survive, or a consumer preferring
    // `recipe.name` still shows the old meal.
    expect(item?.recipe).toBeNull();
  });

  it('sets the recipe when the row becomes recipe-backed', async () => {
    const cache = seedCache([RECIPE, CUSTOM_ITEM]);
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [queuedUpdate],
    });

    await drained(() =>
      result.current.updateItem({
        id: 'item-2',
        meal: { recipeId: 'recipe-1' },
      }),
    );

    const item = readItem(cache, 'item-2') as {
      customMealName: string | null;
      recipe: { id: string; name: string } | null;
    } | null;
    expect(item?.customMealName).toBeNull();
    // Without this the row has neither a name nor a recipe.
    expect(item?.recipe?.id).toBe('recipe-1');
    expect(item?.recipe?.name).toBe('Carbonara');
  });

  it('keeps the recipe when an edit omits the meal', async () => {
    const cache = seedCache([RECIPE, RECIPE_BACKED_ITEM]);
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [queuedUpdate],
    });

    await drained(() =>
      result.current.updateItem({ id: 'item-1', servings: 5 }),
    );

    const item = readItem(cache, 'item-1') as {
      servings: number;
      recipe: { id: string } | null;
    } | null;
    expect(item?.servings).toBe(5);
    expect(item?.recipe?.id).toBe('recipe-1');
  });

  it('reads a picked recipe name from the cache, empty when unseen', () => {
    const cache = seedCache([RECIPE]);
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [],
    });

    expect(result.current.readRecipeName('recipe-1')).toBe('Carbonara');
    expect(result.current.readRecipeName('recipe-unknown')).toBe('');
  });
});

describe("a row loaded by the editor's own query", () => {
  const {
    UpdateTemplateItemDocument,
    RemoveTemplateItemDocument,
  } = require('#features/mealPlan/graphql/mealTemplate.generated');

  /**
   * `GetMealTemplateForEdit` selects no `recipe`, so this is what the cache
   * actually holds for a row the editor loaded. `readFragment` is
   * all-or-nothing against `MealTemplateItemFragment`, which DOES select
   * `recipe` — so the snapshot read came back null for every one of these rows,
   * and both the local write and its revert silently did nothing.
   */
  // `GetMealTemplateForEdit` selects `recipe`, so a row the editor loaded
  // CARRIES the key — null when the row has none. That selection is what lets a
  // revert tell "this row has no recipe" from "this query never asked", which
  // is the distinction `snapshotFields` reads.
  const EDITOR_LOADED_ITEM = {
    __typename: 'MealTemplateItem',
    id: 'item-9',
    dayOffset: 1,
    mealType: MealType.Lunch,
    customMealName: 'Soup',
    servings: 2,
    notes: null,
    recipe: null,
  };

  const EDIT_VARS = { id: 'tpl-9', itemsFirst: MEALS_PAGE_SIZE };

  /** The cache as opening the template in the editor leaves it. */
  const loadedInEditor = () => {
    const cache = makeCache();
    seedQuery(cache, {
      query: GetMealTemplateForEditDocument,
      variables: EDIT_VARS,
      data: {
        __typename: 'Query',
        mealTemplate: {
          __typename: 'MealTemplate',
          id: 'tpl-9',
          name: 'Week',
          description: null,
          category: TemplateCategory.Custom,
          defaultServings: 2,
          tags: [],
          updatedAt: '2026-01-01T00:00:00.000Z',
          itemsConnection: {
            __typename: 'MealTemplateItemConnection',
            totalCount: 1,
            edges: [
              {
                __typename: 'MealTemplateItemEdge',
                node: {
                  __typename: 'MealTemplateItem',
                  id: 'item-9',
                  dayOffset: 1,
                  mealType: MealType.Lunch,
                  customMealName: 'Soup',
                  servings: 2,
                  notes: null,
                  recipe: null,
                },
              },
            ],
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: false,
              endCursor: null,
            },
          },
        },
      },
    });
    return cache;
  };

  /** The template's meals as the editor's query reads them, or null. */
  const mealsInEditor = (cache: ReturnType<typeof makeCache>) =>
    cache
      .readQuery({
        query: GetMealTemplateForEditDocument,
        variables: EDIT_VARS,
      })
      ?.mealTemplate?.itemsConnection.edges.map(edge => edge.node.id) ?? null;

  const queued = (document: TypedDocumentNode, field: string) => ({
    request: { query: document, variables: () => true },
    result: { data: { [field]: null } },
    maxUsageCount: Number.POSITIVE_INFINITY,
  });

  it('applies an offline edit instead of silently doing nothing', async () => {
    const cache = seedCache([EDITOR_LOADED_ITEM]);
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [
        queued(UpdateTemplateItemDocument, 'updateTemplateItem'),
      ],
    });

    await drained(() =>
      result.current.updateItem({ id: 'item-9', servings: 6 }),
    );

    const item = cache.readFragment<{ servings: number }>({
      id: 'MealTemplateItem:item-9',
      fragment:
        require('#features/mealPlan/graphql/mealPlanFragments.generated')
          .MealTemplateItemFragmentDoc,
      fragmentName: 'MealTemplateItemFragment',
      returnPartialData: true,
    });

    expect(item?.servings).toBe(6);
  });

  it('clears a refused recipe pick on a row that had none', async () => {
    const RECIPE = {
      __typename: 'Recipe',
      version: 1,
      id: 'recipe-1',
      name: 'Carbonara',
      imageUrl: null,
      servings: 4,
      totalTimeMinutes: 25,
    };
    const cache = seedCache([RECIPE, EDITOR_LOADED_ITEM]);
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdateTemplateItemDocument,
            variables: () => true,
          },
          error: new Error('refused'),
          maxUsageCount: Number.POSITIVE_INFINITY,
        },
      ],
    });

    let saved: boolean | undefined;
    saved = await drained(() =>
      result.current.updateItem({
        id: 'item-9',
        meal: { recipeId: 'recipe-1' },
      }),
    );
    expect(saved).toBe(false);

    // The row carried `recipe: null`, so the snapshot RECORDS null and the
    // revert writes it back — the recipe the server refused does not stay.
    const item = cache.readFragment<{
      customMealName: string | null;
      recipe: { id: string } | null;
    }>({
      id: 'MealTemplateItem:item-9',
      fragment:
        require('#features/mealPlan/graphql/mealPlanFragments.generated')
          .MealTemplateItemFragmentDoc,
      fragmentName: 'MealTemplateItemFragment',
      returnPartialData: true,
    });

    expect(item?.customMealName).toBe('Soup');
    expect(item?.recipe ?? null).toBeNull();
  });

  it('restores the recipe a refused custom-name edit replaced', async () => {
    // Finding 13's case, and the mirror of the test above. The row IS
    // recipe-backed; renaming it to a custom name writes `recipe: null`
    // locally, and a refusal has to put the link back. It can only do that
    // because the editor's query selects `recipe`, so the snapshot carries it —
    // while it did not, the revert wrote null over a link it had never read and
    // there was no next fetch to repair it.
    const RECIPE = {
      __typename: 'Recipe',
      version: 1,
      id: 'recipe-1',
      name: 'Carbonara',
      imageUrl: null,
      servings: 4,
      totalTimeMinutes: 25,
    };
    const cache = seedCache([
      RECIPE,
      {
        ...EDITOR_LOADED_ITEM,
        customMealName: null,
        recipe: { __typename: 'Recipe', version: 1, id: 'recipe-1' },
      },
    ]);
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdateTemplateItemDocument,
            variables: () => true,
          },
          error: new Error('refused'),
          maxUsageCount: Number.POSITIVE_INFINITY,
        },
      ],
    });

    let saved: boolean | undefined;
    saved = await drained(() =>
      result.current.updateItem({
        id: 'item-9',
        meal: { customMealName: 'Leftovers' },
      }),
    );
    expect(saved).toBe(false);

    const item = cache.readFragment<{
      customMealName: string | null;
      recipe: { id: string } | null;
    }>({
      id: 'MealTemplateItem:item-9',
      fragment:
        require('#features/mealPlan/graphql/mealPlanFragments.generated')
          .MealTemplateItemFragmentDoc,
      fragmentName: 'MealTemplateItemFragment',
      returnPartialData: true,
    });

    expect(item?.customMealName ?? null).toBeNull();
    expect(item?.recipe?.id).toBe('recipe-1');
  });

  it('puts a refused removal back', async () => {
    const cache = loadedInEditor();
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [
        {
          request: {
            query: RemoveTemplateItemDocument,
            variables: () => true,
          },
          error: new Error('refused'),
          maxUsageCount: Number.POSITIVE_INFINITY,
        },
      ],
    });

    let removed: boolean | undefined;
    removed = await drained(() => result.current.removeItem('item-9', 'tpl-9'));

    expect(removed).toBe(false);
    // The row the user can still see must be the row that still exists.
    const restored = cache.readFragment<{ id: string; servings: number }>({
      id: 'MealTemplateItem:item-9',
      fragment:
        require('#features/mealPlan/graphql/mealPlanFragments.generated')
          .MealTemplateItemFragmentDoc,
      fragmentName: 'MealTemplateItemFragment',
      returnPartialData: true,
    });
    expect(restored?.id).toBe('item-9');
    expect(restored?.servings).toBe(2);
    // Back as an edge of the template's meals, complete for the editor.
    expect(mealsInEditor(cache)).toEqual(['item-9']);
  });

  it('takes a removed row off the template at once, and keeps it off while queued', async () => {
    const cache = loadedInEditor();
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [
        queued(RemoveTemplateItemDocument, 'removeTemplateItem'),
      ],
    });

    let removed: boolean | undefined;
    await drained(async () => {
      const pending = result.current.removeItem('item-9', 'tpl-9');
      // Local-first: gone before the request settles.
      expect(mealsInEditor(cache)).toEqual([]);
      removed = await pending;
    });

    expect(removed).toBe(true);
    expect(mealsInEditor(cache)).toEqual([]);
    expect(cache.extract()['MealTemplateItem:item-9']).toBeUndefined();
  });

  it('lists an added row on the loaded template while its add is queued', async () => {
    const cache = loadedInEditor();
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [
        {
          request: { query: AddTemplateItemDocument, variables: () => true },
          result: { data: { addTemplateItem: null } }, // queued
          maxUsageCount: Number.POSITIVE_INFINITY,
        },
      ],
    });

    let added: boolean | undefined;
    added = await drained(() =>
      result.current.addItem({
        templateId: 'tpl-9',
        dayOffset: 2,
        mealType: MealType.Dinner,
        meal: { customMealName: 'Stew' },
      }),
    );

    expect(added).toBe(true);
    // Appended as an edge, and the editor's read of the template stays whole.
    const meals = mealsInEditor(cache);
    expect(meals).toHaveLength(2);
    expect(meals?.[0]).toBe('item-9');
    expect(
      cache.extract()[`MealTemplateItem:${meals?.[1] ?? ''}`],
    ).toMatchObject({ dayOffset: 2, customMealName: 'Stew' });
  });

  it('takes a refused add back off the loaded template', async () => {
    const cache = loadedInEditor();
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [
        {
          request: { query: AddTemplateItemDocument, variables: () => true },
          error: new Error('refused'),
          maxUsageCount: Number.POSITIVE_INFINITY,
        },
      ],
    });

    let added: boolean | undefined;
    added = await drained(() =>
      result.current.addItem({
        templateId: 'tpl-9',
        dayOffset: 2,
        mealType: MealType.Dinner,
        meal: { customMealName: 'Stew' },
      }),
    );

    expect(added).toBe(false);
    expect(mealsInEditor(cache)).toEqual(['item-9']);
  });
});
