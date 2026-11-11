import React from 'react';
import { act, screen, userEvent, within } from '@testing-library/react-native';
import { usePreventRemove } from '@react-navigation/native';
import { makeCache } from '#/apollo/cache';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  seedQuery,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import {
  recipeIngredientRead,
  recipeRead,
} from '#/test-utils/fixtures/recipeFixtures';
import { useStore } from '#store';
import { resetSessionScopedStores } from '#store/sessionScopedStores';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { requirePlatform } from '#platform/install';
import {
  Diet,
  ErrorCode,
  ErrorDisposition,
  FeatureFlagName,
  RecipeCaptureStatus,
} from '#/graphql/generated/schemaTypes';
import {
  MAX_RECIPE_INGREDIENTS,
  RECIPE_INGREDIENTS_PAGE_SIZE,
} from '#domain/recipeIngredientsPaging';
import { MyFeatureFlagsDocument } from '#operations/user/featureFlags.generated';
import {
  CreateRecipeDocument,
  GetRecipeDocument,
  UpdateRecipeDocument,
} from '#features/recipes/graphql/recipe.generated';
import { UseRecipeData_RecipeFragmentDoc } from '#features/recipes/hooks/useRecipeData.generated';
import { RecipeCaptureDocument } from '#features/recipes/hooks/useRecipeCapture.generated';
import { ParseIngredientLinesDocument } from '#features/recipes/hooks/useIngredientPaste.generated';
import { useRecipeCaptureStore } from '#features/recipes/store/recipeCaptureStore';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { kitTestIDs } from '#components/testIDs';
import { FormScreen } from '#components/templates/FormScreen';
import { RecipeIngredientEditor } from '#features/recipes/components/recipeForm/RecipeIngredientEditor';
import { RecipeIngredientList } from '#features/recipes/components/recipeForm/RecipeIngredientList';
import { RecipeStepEditor } from '#features/recipes/components/recipeForm/RecipeStepEditor';
import { RecipeStepList } from '#features/recipes/components/recipeForm/RecipeStepList';
import { RecipeFormScreen } from '../index';

jest.mock('#hooks/navigation/useAppNavigation');

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

// The navigator holds the discard guard: its first argument is whether leaving
// asks first.
const navigation = jest.requireMock<{
  usePreventRemove: typeof usePreventRemove;
}>('@react-navigation/native');
const guardOn = () => jest.mocked(usePreventRemove).mock.lastCall?.[0];

/** The input of the first request a write sent. */
const firstInput = (write: ReturnType<typeof recordMock>) => {
  const [first] = write.fired;
  if (!first) throw new Error('the write was never sent');
  return inputOf(first);
};

let log = operationLog();

interface Visit {
  params?: { recipeId?: string; captureId?: string };
  answers?: ReturnType<typeof recordMock>[];
  cache?: ReturnType<typeof makeCache>;
  /** Whether the server turns ingredient paste on for this person. */
  paste?: boolean;
}

function openForm({
  params,
  answers = [],
  cache = makeCache(),
  paste = true,
}: Visit = {}) {
  const view = renderWithApollo(<RecipeFormScreen route={{ params }} />, {
    cache,
    links: [log.link],
    operationMocks: [
      ...answers.map(answer => answer.mock),
      recordMock(MyFeatureFlagsDocument, {
        data: {
          myFeatureFlags: paste
            ? [
                {
                  __typename: 'FeatureFlagState',
                  flag: FeatureFlagName.IngredientPaste,
                  enabled: true,
                },
              ]
            : [],
        },
      }).mock,
    ],
  });
  return { ...view, cache };
}

const FEAST = recipeRead({
  name: 'Feast',
  version: 3,
  instructions: [{ __typename: 'RecipeInstruction', step: 1, text: 'Cook' }],
  ingredients: [recipeIngredientRead('ri-1', 'Salt')],
});

/** An edit of recipe-1: the first read answers `recipe`, later ones `rereads`. */
async function openEdit({
  recipe = FEAST,
  rereads = [],
  answers = [],
}: {
  recipe?: typeof FEAST;
  rereads?: ReturnType<typeof recordMock>[];
  answers?: ReturnType<typeof recordMock>[];
} = {}) {
  const view = openForm({
    params: { recipeId: 'recipe-1' },
    answers: [
      recordMock(GetRecipeDocument, {
        data: { recipe },
        maxUsageCount: rereads.length > 0 ? 1 : 10,
      }),
      ...rereads,
      ...answers,
    ],
  });
  await log.landed(GetRecipeDocument);
  return view;
}

const formSave = () =>
  within(screen.UNSAFE_getByType(FormScreen)).getByLabelText(t('labels.save'));
const ingredients = () => within(screen.UNSAFE_getByType(RecipeIngredientList));
const ingredientEditor = () =>
  within(screen.UNSAFE_getByType(RecipeIngredientEditor));
const steps = () => within(screen.UNSAFE_getByType(RecipeStepList));
const stepEditor = () => within(screen.UNSAFE_getByType(RecipeStepEditor));

type User = ReturnType<typeof userEvent.setup>;

async function addIngredient(user: User, name: string) {
  await user.press(ingredients().getByText(t('recipes.addIngredient')));
  await user.type(
    ingredientEditor().getByPlaceholderText(
      t('recipes.ingredientNamePlaceholder'),
    ),
    name,
  );
  await user.press(ingredientEditor().getByLabelText(t('labels.save')));
}

async function addStep(user: User, instruction: string) {
  await user.press(steps().getByText(t('recipes.addStep')));
  await user.type(
    stepEditor().getByPlaceholderText(t('recipes.stepInstructionPlaceholder')),
    instruction,
  );
  await user.press(stepEditor().getByLabelText(t('labels.save')));
}

/** A new recipe with a name, a line and a step: all it needs to save. */
async function fillNew(user: User) {
  await user.type(
    screen.getByPlaceholderText(t('recipes.namePlaceholder')),
    'Miso salmon',
  );
  await addIngredient(user, 'Salmon');
  await addStep(user, 'Roast');
}

/** Presses a button of the last alert raised. */
async function answerAlert(text: string) {
  const [, , buttons] = jest.mocked(alertService.alert).mock.lastCall ?? [];
  const onPress = buttons?.find(button => button.text === text)?.onPress;
  if (!onPress) throw new Error(`no "${text}" in the last alert`);
  await act(async () => {
    onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(navigation, 'usePreventRemove')
    .mockImplementation(() => undefined);
  log = operationLog();
  resetSessionScopedStores();
  useStore.setState({
    user: {
      id: 'user-1',
      email: 'cook@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    isOnline: true,
    apiReachable: true,
  });
});

describe('a new recipe', () => {
  it('says on each field what it lacks, and saves nothing', async () => {
    const create = recordMock(CreateRecipeDocument, { held: true });
    const announce = jest.spyOn(requirePlatform('screenReader'), 'announce');
    openForm({ answers: [create] });

    await userEvent.setup().press(formSave());

    expect(screen.getByText(t('recipes.createRecipe'))).toBeTruthy();
    expect(screen.getByText(t('recipes.nameRequired'))).toBeTruthy();
    expect(screen.getByText(t('recipes.ingredientRequired'))).toBeTruthy();
    expect(screen.getByText(t('recipes.stepRequired'))).toBeTruthy();
    // A screen reader hears the first.
    expect(announce).toHaveBeenCalledWith(t('recipes.nameRequired'));
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(create.fired).toEqual([]);
    announce.mockRestore();
  });

  it('sends what was typed and picked, written by the person', async () => {
    const create = recordMock(CreateRecipeDocument, { held: true });
    const { cache } = openForm({ answers: [create] });
    const user = userEvent.setup();
    await fillNew(user);
    await user.press(screen.getByText(t('recipes.diet.VEGETARIAN')));

    await user.press(formSave());
    await log.requested(CreateRecipeDocument);

    const sent = firstInput(create);
    expect(sent).toMatchObject({
      name: 'Miso salmon',
      ingredients: [expect.objectContaining({ name: 'Salmon' })],
      instructions: [expect.objectContaining({ text: 'Roast' })],
      dietary: expect.objectContaining({ diets: [Diet.Vegetarian] }),
    });
    // The new recipe shows at once, as the person's own.
    const shown = cache.readFragment({
      fragment: UseRecipeData_RecipeFragmentDoc,
      fragmentName: 'useRecipeData_recipe',
      id: `Recipe:${String(sent.id)}`,
      optimistic: true,
    });
    expect(shown?.createdBy?.id).toBe('user-1');
  });

  it('leaves once the save lands, without asking about what it saved', async () => {
    const guardAtLeave: unknown[] = [];
    mockNav.goBack.mockImplementation(() => {
      guardAtLeave.push(guardOn());
    });
    openForm({
      answers: [
        recordMock(CreateRecipeDocument, {
          data: {
            createRecipe: {
              __typename: 'CreateRecipePayload',
              recipe: { id: 'recipe-new' },
            },
          },
        }),
      ],
    });
    const user = userEvent.setup();
    await fillNew(user);
    expect(guardOn()).toBe(true);

    await user.press(formSave());
    await log.landed(CreateRecipeDocument);

    expect(guardAtLeave).toEqual([false]);
  });

  it('takes no second save while one is out', async () => {
    const create = recordMock(CreateRecipeDocument, { held: true });
    openForm({ answers: [create] });
    const user = userEvent.setup();
    await fillNew(user);

    await user.press(formSave());
    await log.requested(CreateRecipeDocument);
    await user.press(formSave());

    expect(create.fired).toHaveLength(1);
  });

  it('shows a refusal naming a field on that field, not in an alert', async () => {
    openForm({
      answers: [
        recordMock(CreateRecipeDocument, {
          data: {
            createRecipe: {
              __typename: 'ValidationError',
              code: ErrorCode.ValidationFailed,
              disposition: ErrorDisposition.Fail,
              message: 'Name is too long',
              field: 'input.name',
            },
          },
        }),
      ],
    });
    const user = userEvent.setup();
    await fillNew(user);

    await user.press(formSave());
    await log.landed(CreateRecipeDocument);

    // The refusal settles a few promise turns after its answer lands.
    await act(async () => undefined);

    expect(screen.getByText(t('recipes.createRecipeFailed'))).toBeTruthy();
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(mockNav.goBack).not.toHaveBeenCalled();
  });

  it('closes from its header', async () => {
    openForm();

    await userEvent
      .setup()
      .press(
        within(screen.UNSAFE_getByType(FormScreen)).getByTestId(
          kitTestIDs.headerCloseButton,
        ),
      );

    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('its lists', () => {
  it('edit a line in place, remove it, and add the next from empty', async () => {
    openForm();
    const user = userEvent.setup();
    await addIngredient(user, 'Salt');
    const name = () =>
      ingredientEditor().getByPlaceholderText(
        t('recipes.ingredientNamePlaceholder'),
      );

    await user.press(ingredients().getByText('Salt'));
    expect(
      ingredientEditor().getByText(t('recipes.editIngredient')),
    ).toBeTruthy();
    expect(name().props.value).toBe('Salt');
    await user.clear(name());
    await user.type(name(), 'Sea salt');
    await user.press(ingredientEditor().getByLabelText(t('labels.save')));

    expect(ingredients().queryByText('Salt')).not.toBeOnTheScreen();
    expect(ingredients().getByText('Sea salt')).toBeTruthy();

    await user.press(
      ingredients().getByLabelText(t('a11y.removeNamed', { name: 'Sea salt' })),
    );
    expect(ingredients().queryByText('Sea salt')).not.toBeOnTheScreen();

    await user.press(ingredients().getByText(t('recipes.addIngredient')));
    expect(
      ingredientEditor().getByText(t('recipes.addIngredient')),
    ).toBeTruthy();
    expect(name().props.value).toBe('');
  });

  it('edit a step in place, remove it, and add the next from empty', async () => {
    openForm();
    const user = userEvent.setup();
    await addStep(user, 'Roast');
    const instruction = () =>
      stepEditor().getByPlaceholderText(
        t('recipes.stepInstructionPlaceholder'),
      );

    await user.press(steps().getByText('Roast'));
    expect(stepEditor().getByText(t('recipes.editStep'))).toBeTruthy();
    expect(instruction().props.value).toBe('Roast');
    await user.clear(instruction());
    await user.type(instruction(), 'Roast for 20 minutes');
    await user.press(stepEditor().getByLabelText(t('labels.save')));

    expect(steps().queryByText('Roast')).not.toBeOnTheScreen();
    expect(steps().getByText('Roast for 20 minutes')).toBeTruthy();

    await user.press(
      steps().getByLabelText(
        t('a11y.removeNamed', { name: 'Roast for 20 minutes' }),
      ),
    );
    expect(steps().queryByText('Roast for 20 minutes')).not.toBeOnTheScreen();

    await user.press(steps().getByText(t('recipes.addStep')));
    expect(stepEditor().getByText(t('recipes.addStep'))).toBeTruthy();
    expect(instruction().props.value).toBe('');
  });
});

describe('pasting ingredients', () => {
  it('reads pasted lines into the list, offering only the room it has', async () => {
    openForm({
      answers: [
        recordMock(ParseIngredientLinesDocument, {
          data: {
            parseIngredientLines: {
              lines: [
                {
                  originalText: '2 cups flour',
                  name: 'flour',
                  quantity: 2,
                  unit: null,
                  preparation: null,
                  note: null,
                  isOptional: false,
                  section: null,
                  item: null,
                },
              ],
            },
          },
        }),
      ],
    });
    await log.landed(MyFeatureFlagsDocument);
    const user = userEvent.setup();
    await addIngredient(user, 'Salt');

    await user.press(screen.getByTestId(recipesTestIDs.pasteIngredientsButton));
    expect(
      screen.getByText(
        t('recipes.pasteIngredientsRoom', {
          count: MAX_RECIPE_INGREDIENTS - 1,
        }),
      ),
    ).toBeTruthy();
    await user.type(
      screen.getByTestId(recipesTestIDs.pasteIngredientsInput),
      '2 cups flour',
    );
    await user.press(screen.getByTestId(recipesTestIDs.pasteIngredientsAdd));
    await log.landed(ParseIngredientLinesDocument);

    expect(ingredients().getByText('flour')).toBeTruthy();
  });

  it('is not offered without the capability', async () => {
    openForm({ paste: false });
    await log.landed(MyFeatureFlagsDocument);

    expect(
      screen.queryByTestId(recipesTestIDs.pasteIngredientsButton),
    ).not.toBeOnTheScreen();
  });
});

describe('a capture', () => {
  type Draft = NonNullable<
    NonNullable<
      MockDataFor<typeof RecipeCaptureDocument>['recipeCapture']
    >['draft']
  >;
  const line = (text: string) => ({
    originalText: text,
    name: text,
    quantity: null,
    unit: null,
    item: null,
    candidates: [],
  });
  const captured = (id: string, draft: Draft) =>
    recordMock(RecipeCaptureDocument, {
      data: {
        recipeCapture: {
          id,
          status: RecipeCaptureStatus.Incomplete,
          recipe: null,
          draft,
        },
      },
    });

  // A caption that lists ingredients and no method ends INCOMPLETE.
  it('opens filled with what an incomplete capture read, saving nothing', async () => {
    const create = recordMock(CreateRecipeDocument, { held: true });
    openForm({
      params: { captureId: 'capture-1' },
      answers: [
        captured('capture-1', {
          name: 'Miso salmon',
          lines: ['2 tbsp white miso', '1 tbsp honey', 'salt, to taste'].map(
            line,
          ),
          steps: [],
        }),
        create,
      ],
    });
    await log.landed(RecipeCaptureDocument);

    expect(screen.getByDisplayValue('Miso salmon')).toBeTruthy();
    expect(ingredients().getByText('1 tbsp honey')).toBeTruthy();
    expect(screen.getByText(t('recipes.stepRequired'))).toBeTruthy();
    expect(create.fired).toEqual([]);
  });

  it('saves a finished capture with the site and link it was read from, then clears it', async () => {
    useRecipeCaptureStore.getState().addReading({
      id: 'capture-2',
      source: 'text',
      label: 'Miso salmon',
      link: 'https://www.instagram.com/p/abc/',
      createdAt: new Date().toISOString(),
    });
    const create = recordMock(CreateRecipeDocument, {
      data: {
        createRecipe: {
          __typename: 'CreateRecipePayload',
          recipe: { id: 'recipe-new' },
        },
      },
    });
    openForm({
      params: { captureId: 'capture-2' },
      answers: [
        captured('capture-2', {
          name: 'Miso salmon',
          imageUrl: null,
          author: 'Ana',
          sourceName: 'instagram.com',
          lines: [line('salmon')],
          steps: [{ step: 1, text: 'Roast', section: null }],
        }),
        create,
      ],
    });
    await log.landed(RecipeCaptureDocument);

    await userEvent.setup().press(formSave());
    await log.landed(CreateRecipeDocument);

    expect(firstInput(create)).toMatchObject({
      attribution: {
        originalAuthor: 'Ana',
        source: 'instagram.com',
        sourceUrl: 'https://www.instagram.com/p/abc/',
      },
    });
    // It leaves the Recipes tab, where it waited.
    expect(
      useRecipeCaptureStore.getState().entries.map(entry => entry.id),
    ).not.toContain('capture-2');
  });

  it('offers to read a capture again rather than a blank form', async () => {
    openForm({
      params: { captureId: 'capture-3' },
      answers: [
        recordMock(RecipeCaptureDocument, {
          error: new Error('Network request failed'),
          maxUsageCount: 1,
        }),
        captured('capture-3', {
          name: 'Miso salmon',
          lines: [line('salmon')],
          steps: [],
        }),
      ],
    });
    await log.landed(RecipeCaptureDocument);

    expect(screen.getByText(t('dataState.errorTitle'))).toBeTruthy();
    await userEvent.setup().press(screen.getByText(t('labels.tryAgain')));
    await log.landed(RecipeCaptureDocument, 2);

    expect(screen.getByDisplayValue('Miso salmon')).toBeTruthy();
  });
});

describe('an edit', () => {
  it('opens filled from the recipe, and sends the form it read', async () => {
    const update = recordMock(UpdateRecipeDocument, { held: true });
    await openEdit({ answers: [update] });

    expect(screen.getByText(t('recipes.editRecipe'))).toBeTruthy();
    expect(screen.getByDisplayValue('Feast')).toBeTruthy();
    await userEvent.setup().press(formSave());
    await log.requested(UpdateRecipeDocument);

    expect(update.fired[0]).toEqual({
      input: expect.objectContaining({
        id: 'recipe-1',
        version: 3,
        name: 'Feast',
        ingredients: [expect.objectContaining({ name: 'Salt', quantity: 1 })],
      }),
      ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
    });
  });

  it('asks before leaving once edited, and leaves without asking once saved', async () => {
    const guardAtLeave: unknown[] = [];
    mockNav.goBack.mockImplementation(() => {
      guardAtLeave.push(guardOn());
    });
    await openEdit({
      answers: [
        recordMock(UpdateRecipeDocument, {
          data: {
            updateRecipe: {
              __typename: 'UpdateRecipePayload',
              recipe: { id: 'recipe-1' },
            },
          },
        }),
      ],
    });
    expect(guardOn()).toBe(false);
    const user = userEvent.setup();

    await user.type(screen.getByDisplayValue('Feast'), ' night');
    expect(guardOn()).toBe(true);
    await user.press(formSave());
    await log.landed(UpdateRecipeDocument);

    expect(guardAtLeave).toEqual([false]);
  });

  it('offers to read the recipe again in place of a blank form', async () => {
    openForm({
      params: { recipeId: 'recipe-1' },
      answers: [
        recordMock(GetRecipeDocument, {
          error: new Error('Network request failed'),
          maxUsageCount: 1,
        }),
        recordMock(GetRecipeDocument, { data: { recipe: FEAST } }),
      ],
    });
    await log.landed(GetRecipeDocument);

    expect(screen.getByText(t('dataState.errorTitle'))).toBeTruthy();
    await userEvent.setup().press(screen.getByText(t('labels.tryAgain')));
    await log.landed(GetRecipeDocument, 2);

    expect(screen.getByDisplayValue('Feast')).toBeTruthy();
  });

  it('keeps the form when a read fails over the recipe it holds', async () => {
    const cache = makeCache();
    seedQuery(cache, {
      query: GetRecipeDocument,
      variables: {
        id: 'recipe-1',
        ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
      },
      data: { recipe: FEAST },
    });
    openForm({
      params: { recipeId: 'recipe-1' },
      cache,
      answers: [
        recordMock(GetRecipeDocument, {
          error: new Error('Network request failed'),
        }),
      ],
    });
    await log.landed(GetRecipeDocument);

    expect(screen.getByDisplayValue('Feast')).toBeTruthy();
    expect(screen.queryByText(t('dataState.errorTitle'))).not.toBeOnTheScreen();
  });

  it('reloads the form from an edit made elsewhere when the save is refused for it', async () => {
    await openEdit({
      rereads: [
        recordMock(GetRecipeDocument, {
          data: { recipe: { ...FEAST, name: 'Feast for six', version: 4 } },
        }),
      ],
      answers: [
        recordMock(UpdateRecipeDocument, {
          data: {
            updateRecipe: {
              __typename: 'ConflictError',
              code: ErrorCode.VersionConflict,
              message: 'Stale',
            },
          },
        }),
      ],
    });
    await userEvent.setup().press(formSave());
    await log.landed(UpdateRecipeDocument);

    await answerAlert(t('labels.refresh'));
    await log.landed(GetRecipeDocument, 2);

    expect(screen.getByDisplayValue('Feast for six')).toBeTruthy();
  });

  it('keeps what was typed and says so when that reload fails', async () => {
    await openEdit({
      rereads: [
        recordMock(GetRecipeDocument, {
          error: new Error('Network request failed'),
        }),
      ],
      answers: [
        recordMock(UpdateRecipeDocument, {
          data: {
            updateRecipe: {
              __typename: 'ConflictError',
              code: ErrorCode.VersionConflict,
              message: 'Stale',
            },
          },
        }),
      ],
    });
    await userEvent.setup().press(formSave());
    await log.landed(UpdateRecipeDocument);

    await answerAlert(t('labels.refresh'));
    await log.landed(GetRecipeDocument, 2);

    expect(alertService.alert).toHaveBeenLastCalledWith(
      t('recipes.loadFailed'),
      t('errors.codes.genericRetry'),
    );
    expect(screen.getByDisplayValue('Feast')).toBeTruthy();
  });

  // `hasNextPage` on the one page the form reads: the form holds part of the
  // list, and no field of it can be fixed to make the save whole.
  it('sends nothing for a recipe over the ingredient limit, and says why', async () => {
    const update = recordMock(UpdateRecipeDocument, { held: true });
    await openEdit({
      recipe: {
        ...FEAST,
        ingredientsConnection: {
          ...FEAST.ingredientsConnection,
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: true,
            endCursor: 'cursor-100',
          },
          totalCount: 150,
        },
      },
      answers: [update],
    });

    await userEvent.setup().press(formSave());

    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      t('recipes.editIngredientsOverLimit', { count: MAX_RECIPE_INGREDIENTS }),
    );
    expect(update.fired).toEqual([]);
  });

  // A pending edit made elsewhere can propose more than the form allows.
  it('reports a list over the ingredient limit on its section, not in an alert', async () => {
    const update = recordMock(UpdateRecipeDocument, { held: true });
    await openEdit({
      recipe: {
        ...FEAST,
        pendingRevision: {
          __typename: 'RecipeRevision',
          id: 'rev-1',
          proposed: {
            name: 'Feast',
            imageUrl: null,
            videoUrl: null,
            instructions: [{ step: 1, text: 'Cook' }],
            ingredients: Array.from(
              { length: MAX_RECIPE_INGREDIENTS + 1 },
              (_, sortOrder) => ({
                name: `Ingredient ${sortOrder}`,
                quantity: 1,
                sortOrder,
              }),
            ),
          },
        },
      },
      answers: [update],
    });

    await userEvent.setup().press(formSave());

    expect(
      screen.getByText(
        t('recipes.ingredientsTooMany', { count: MAX_RECIPE_INGREDIENTS }),
      ),
    ).toBeTruthy();
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(update.fired).toEqual([]);
  });
});
