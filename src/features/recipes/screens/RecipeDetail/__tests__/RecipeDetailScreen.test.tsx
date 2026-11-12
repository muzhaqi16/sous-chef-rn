import React from 'react';
import { RefreshControl } from 'react-native';
import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  type MockDataFor,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { homesWithRole } from '#/test-utils/fixtures/homeFixtures';
import {
  recipeIngredientRead,
  recipeRead,
} from '#/test-utils/fixtures/recipeFixtures';
import {
  listsRead,
  ownShoppingList,
} from '#/test-utils/fixtures/shoppingListFixtures';
import { useStore } from '#store';
import { resetSessionScopedStores } from '#store/sessionScopedStores';
import { recordOpenedCatalogRecipe } from '#features/recipes/store/openedCatalogRecipes';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import {
  Diet,
  DietaryAlertState,
  ExternalSource,
  ExternalSyncStatus,
  MembershipRole,
  RecipeStatus,
} from '#/graphql/generated/schemaTypes';
import { hasTipFact } from '#hooks/settings/useFeatureHint';
import { formatMonthDayYear } from '#/utils/formatters/date';
import { GetHomesDocument } from '#operations/home/home.generated';
import { GetDietaryProfileDocument } from '#operations/user/user.generated';
import { MyFeatureFlagsDocument } from '#operations/user/featureFlags.generated';
import {
  AddRecipeToFavoritesDocument,
  ForkRecipeDocument,
  OpenCatalogRecipeDocument,
  GetRecipeDocument,
  MarkRecipeAsCookedDocument,
  GetRecipeReviewsDocument,
  SavedRecipeFoldersDocument,
  UpdateFavoriteRecipeDocument,
  UpdateRecipeDocument,
} from '#features/recipes/graphql/recipe.generated';
import { SaveRecipeSheet } from '#features/recipes/components/modals/SaveRecipeSheet/SaveRecipeSheet';
import { ManageRecipeSheet } from '#features/recipes/components/modals/ManageRecipeSheet/ManageRecipeSheet';
import { MarkCookedModal } from '#features/recipes/ui/MarkCookedModal';
import { RecipeDietaryAlertsDocument } from '#features/recipes/hooks/useRecipeDietaryAlerts.generated';
import { RecipeSubstitutesDocument } from '#features/recipes/hooks/useRecipeSubstitutes.generated';
import { MySavedRecipesDocument } from '#features/recipes/screens/useSavedRecipes.generated';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { RecipeMissingIngredientsDocument } from '#features/recipes/hooks/useRecipeMissingIngredients.generated';
import { AddItemsToShoppingListFromRecipeDocument } from '#features/recipes/hooks/useRecipeShoppingList.generated';
import { isRecord } from '#/utils/isRecord';
import { kitTestIDs } from '#components/testIDs';
import { RecipeDetail } from '../index';

jest.mock('#hooks/navigation/useAppNavigation');
// The route is the boundary: the screen reads which recipe from it.
const mockRoute: { params: Record<string, unknown> } = { params: {} };
jest.mock('@react-navigation/native', () => {
  const { useEffect: useMountEffect } = jest.requireActual('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (effect: () => undefined | (() => void)) =>
      useMountEffect(effect, [effect]),
    useIsFocused: () => true,
    useRoute: () => mockRoute,
  };
});

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const ME = 'user-1';

let log = operationLog();

interface Visit {
  recipe?: ReturnType<typeof recipeRead> | null;
  /** The recipe cannot be read. */
  readFails?: boolean;
  answers?: ReturnType<typeof recordMock>[];
  /** Answers to the recipe's later reads; the first is answered once. */
  rereads?: ReturnType<typeof recordMock>[];
  /** How the screen was reached; recipe-1 by its id unless stated. */
  params?: Record<string, unknown>;
  /** Whether to wait for the recipe's read. */
  awaitRead?: boolean;
}

/** The detail screen opened on recipe-1, its reads answered. */
async function openRecipe({
  recipe = recipeRead(),
  readFails = false,
  answers = [],
  rereads = [],
  params = { recipeId: 'recipe-1' },
  awaitRead = true,
}: Visit = {}) {
  mockRoute.params = params;
  const cache = makeCache();
  seedQuery(cache, {
    query: GetHomesDocument,
    data: homesWithRole(
      [
        {
          id: 'h1',
          name: 'Home',
          pantries: [{ id: 'p1', name: 'Kitchen', isDefault: true }],
        },
      ],
      MembershipRole.Owner,
    ),
  });
  const read = readFails
    ? recordMock(GetRecipeDocument, {
        error: new Error('Network request failed'),
        maxUsageCount: 1,
      })
    : recordMock(GetRecipeDocument, {
        data: { recipe },
        maxUsageCount: rereads.length > 0 ? 1 : 10,
      });
  const view = renderWithApollo(
    <RecipeDetail route={{ params: mockRoute.params }} />,
    {
      cache,
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        read.mock,
        ...rereads.map(answer => answer.mock),
        recordMock(GetRecipeReviewsDocument, { held: true }).mock,
        recordMock(RecipeDietaryAlertsDocument, { held: true }).mock,
        recordMock(RecipeSubstitutesDocument, { held: true }).mock,
        recordMock(SavedRecipeFoldersDocument, { held: true }).mock,
        recordMock(RecipeMissingIngredientsDocument, { held: true }).mock,
        recordMock(MySavedRecipesDocument, { held: true }).mock,
        recordMock(GetDietaryProfileDocument, { held: true }).mock,
        recordMock(MyFeatureFlagsDocument, { data: { myFeatureFlags: [] } })
          .mock,
        listsRead([ownShoppingList('list-1', 'Groceries')]).mock,
      ],
    },
  );
  if (awaitRead) await log.landed(GetRecipeDocument);
  return { ...view, cache, read };
}

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  // A fresh session: no catalog recipe was opened on this device before.
  resetSessionScopedStores();
  useStore.setState({
    user: {
      id: ME,
      email: 'cook@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    selectedHomeId: 'h1',
    selectedPantryId: 'p1',
    isHomeSelectionReady: true,
    isOnline: true,
    apiReachable: true,
  });
});

/** Presses a header action, through the "more" menu when it overflowed there. */
async function pressHeaderAction(testID: string) {
  const shown = screen.queryByTestId(testID);
  if (shown) {
    await userEvent.setup().press(shown);
    return;
  }
  // An overflowed action runs once the menu has closed.
  fireEvent.press(screen.getByTestId(kitTestIDs.headerMoreButton));
  fireEvent.press(screen.getByTestId(testID));
}

/** Whether the header offers an action, shown or in its "more" menu. */
function headerOffers(testID: string) {
  if (screen.queryByTestId(testID)) return true;
  const more = screen.queryByTestId(kitTestIDs.headerMoreButton);
  if (!more) return false;
  fireEvent.press(more);
  return screen.queryByTestId(testID) !== null;
}

/** Pulls the screen down to refresh it. */
function pull() {
  act(() => {
    screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
  });
}

type SavedDetails = NonNullable<ReturnType<typeof recipeRead>['savedDetails']>;

/** A save in no folder, untagged, unrated and never cooked, unless stated. */
const savedDetails = (overrides: SavedDetails = {}): SavedDetails => ({
  __typename: 'SavedRecipe',
  id: 'saved-1',
  folder: null,
  tags: [],
  notes: null,
  personalRating: null,
  cookedCount: 0,
  lastCookedAt: null,
  ...overrides,
});

const MINE: ReturnType<typeof recipeRead>['createdBy'] = {
  __typename: 'User',
  id: ME,
  email: 'cook@example.com',
  displayName: 'Sam',
};

describe('a recipe', () => {
  it('shows its title, servings, time and diets', async () => {
    await openRecipe({
      recipe: recipeRead({
        diets: [Diet.Vegetarian],
        description: 'A classic.',
      }),
    });

    expect(screen.getAllByText('Lasagna').length).toBeGreaterThan(0);
    expect(
      screen.getByText(t('labels.servingsCount', { count: 4 })),
    ).toBeTruthy();
    expect(screen.getByText(t('labels.min', { count: 45 }))).toBeTruthy();
    expect(screen.getByText(t('labels.vegetarian'))).toBeTruthy();
    expect(screen.getByText('A classic.')).toBeTruthy();
  });

  it("shows its row's name offline when the device does not hold it", async () => {
    useStore.setState({ apiReachable: false });
    await openRecipe({
      params: { recipeId: 'recipe-1', row: { name: 'Lasagna, from the row' } },
      readFails: true,
    });

    expect(screen.getAllByText('Lasagna, from the row').length).toBeGreaterThan(
      0,
    );
  });

  it('names no time when it takes none', async () => {
    await openRecipe({ recipe: recipeRead({ totalTimeMinutes: 0 }) });

    expect(
      screen.queryByText(t('labels.min', { count: 0 })),
    ).not.toBeOnTheScreen();
  });

  it("shows its provider's notice", async () => {
    await openRecipe({
      recipe: recipeRead({
        dataAttributions: [
          {
            __typename: 'DataAttribution',
            source: ExternalSource.Spoonacular,
            notice: 'Recipe data by Spoonacular',
            licenseUrl: null,
            sourceUrl: null,
          },
        ],
      }),
    });

    expect(screen.getByText('Recipe data by Spoonacular')).toBeTruthy();
  });

  it('says a recipe with no record is not found', async () => {
    await openRecipe({ recipe: null });

    expect(screen.getByText(t('recipes.recipeNotFoundDb'))).toBeTruthy();
  });

  it('notes it was opened, for the tips', async () => {
    await openRecipe();

    expect(hasTipFact('recipeOpened', ME)).toBe(true);
  });
});

describe('cooking it', () => {
  const saved = (cookedCount: number, lastCookedAt: string | null) =>
    recipeRead({
      savedDetails: savedDetails({
        folder: 'Weeknights',
        tags: ['quick'],
        notes: 'double cheese',
        personalRating: 4,
        cookedCount,
        lastCookedAt,
      }),
    });

  it('offers to mark a recipe never cooked', async () => {
    await openRecipe();

    expect(screen.getByText(t('recipes.markCooked'))).toBeTruthy();
  });

  it('says how often it was cooked, and when last', async () => {
    await openRecipe({ recipe: saved(3, '2026-10-05T12:00:00.000Z') });

    expect(
      screen.getByText(
        t('recipes.cookedSummary', {
          count: 3,
          date: formatMonthDayYear(new Date('2026-10-05T12:00:00.000Z')),
        }),
      ),
    ).toBeTruthy();
  });

  it('says how often with no date on record', async () => {
    await openRecipe({ recipe: saved(1, null) });

    expect(
      screen.getByText(t('recipes.cookedCount', { count: 1 })),
    ).toBeTruthy();
  });

  // The sheet stand-in renders a closed dialog too; its confirm is what counts.
  it('is marked cooked from its dialog, for who the person cooks for', async () => {
    const cooked = recordMock(MarkRecipeAsCookedDocument, { held: true });
    await openRecipe({
      answers: [
        cooked,
        recordMock(GetDietaryProfileDocument, {
          data: {
            me: {
              __typename: 'User',
              id: ME,
              dietaryProfile: {
                __typename: 'DietaryProfile',
                id: 'profile-1',
                cooksFor: 2,
              },
            },
          },
        }),
      ],
    });
    await log.landed(GetDietaryProfileDocument);
    const user = userEvent.setup();

    await user.press(screen.getByText(t('recipes.markCooked')));
    // The cook sheet is presented with its form.
    expect(screen.UNSAFE_getByType(MarkCookedModal).props.visible).toBe(true);
    const confirm = screen.getAllByText(t('markCookedModal.markCooked')).at(-1);
    if (!confirm) throw new Error('no confirm in the cook dialog');
    await user.press(confirm);
    await log.requested(MarkRecipeAsCookedDocument);

    expect(cooked.fired[0]).toMatchObject({
      input: { recipeId: 'recipe-1', servings: 2 },
    });
  });

  it('clears its rating when its own star is pressed again', async () => {
    const rated = recordMock(UpdateFavoriteRecipeDocument, { held: true });
    await openRecipe({ recipe: saved(0, null), answers: [rated] });
    const [fourth] = screen.getAllByLabelText(
      t('a11y.rateStars', { count: 4 }),
    );
    if (!fourth) throw new Error('no fourth star');

    await userEvent.setup().press(fourth);
    await log.requested(UpdateFavoriteRecipeDocument);

    expect(rated.fired[0]).toMatchObject({
      input: { recipeId: 'recipe-1', personalRating: null },
    });
  });

  it("shows a saved recipe's folder, tags and notes", async () => {
    await openRecipe({ recipe: saved(0, null) });

    expect(screen.getByText('Weeknights')).toBeTruthy();
    expect(screen.getAllByText('quick').length).toBeGreaterThan(0);
    expect(screen.getByText('double cheese')).toBeTruthy();
  });

  it('shows no saved details for a recipe not saved', async () => {
    await openRecipe();

    expect(screen.queryByText(t('recipes.none'))).not.toBeOnTheScreen();
  });
});

describe("one's own recipe", () => {
  it('is edited and published from its header, and never forked or reported', async () => {
    const published = recordMock(UpdateRecipeDocument, { held: true });
    await openRecipe({
      recipe: recipeRead({ createdBy: MINE, status: RecipeStatus.Draft }),
      answers: [published],
    });

    await pressHeaderAction(recipesTestIDs.editButton);
    expect(mockNav.toRecipeEdit).toHaveBeenCalledWith({ recipeId: 'recipe-1' });
    await pressHeaderAction(recipesTestIDs.publishButton);
    await log.requested(UpdateRecipeDocument);

    expect(published.fired[0]).toMatchObject({
      input: { status: RecipeStatus.Published },
    });
    expect(headerOffers(recipesTestIDs.forkButton)).toBe(false);
    expect(headerOffers(recipesTestIDs.reportButton)).toBe(false);
  });
});

describe("someone else's recipe", () => {
  it('is forked into a recipe of ones own, which opens', async () => {
    const forked = recordMock(ForkRecipeDocument, {
      dataFor: (variables): MockDataFor<typeof ForkRecipeDocument> => ({
        forkRecipe: {
          __typename: 'ForkRecipePayload',
          recipe: {
            __typename: 'Recipe',
            id: String(inputOf(variables).newRecipeId),
          },
        },
      }),
    });
    await openRecipe({ answers: [forked] });

    await pressHeaderAction(recipesTestIDs.forkButton);
    await log.landed(ForkRecipeDocument);

    // The fork mints its id, so the copy opens before the server answers.
    const [sent] = forked.fired;
    expect(mockNav.toRecipeDetail).toHaveBeenCalledWith({
      recipeId: sent && inputOf(sent).newRecipeId,
    });
    expect(headerOffers(recipesTestIDs.editButton)).toBe(false);
  });

  it('can be reported', async () => {
    await openRecipe();

    expect(headerOffers(recipesTestIDs.reportButton)).toBe(true);
  });
});

describe('saving it', () => {
  it('saves to Favorites from the heart, once while that save is out', async () => {
    const saved = recordMock(AddRecipeToFavoritesDocument, { held: true });
    await openRecipe({ answers: [saved] });
    const heart = screen.getByLabelText(t('recipes.favoriteA11y'));

    fireEvent.press(heart);
    await log.requested(AddRecipeToFavoritesDocument);
    fireEvent.press(heart);

    expect(saved.fired).toEqual([
      {
        input: expect.objectContaining({
          recipeId: 'recipe-1',
          folder: 'Favorites',
        }),
      },
    ]);
  });

  it.each([
    ['saves one not saved, with a folder', null, 'save'],
    ['manages a saved one', savedDetails({ folder: 'Weeknights' }), 'manage'],
  ] as const)('from its folder, %s', async (_, saved, sheet) => {
    await openRecipe({ recipe: recipeRead({ savedDetails: saved }) });

    await pressHeaderAction(recipesTestIDs.folderButton);

    // The stand-in renders every sheet, so which one was presented.
    expect({
      save: screen.UNSAFE_getByType(SaveRecipeSheet).props.visible,
      manage: screen.UNSAFE_getByType(ManageRecipeSheet).props.visible,
    }).toEqual({ save: sheet === 'save', manage: sheet === 'manage' });
  });

  it('manages a favorite from its heart rather than saving it again', async () => {
    const saved = recordMock(AddRecipeToFavoritesDocument, { held: true });
    await openRecipe({
      recipe: recipeRead({
        savedDetails: savedDetails({ folder: 'Favorites' }),
      }),
      answers: [saved],
    });

    await userEvent
      .setup()
      .press(screen.getByLabelText(t('recipes.unfavoriteA11y')));

    expect(saved.fired).toEqual([]);
  });
});

describe('a recipe it cannot read', () => {
  it('says so, offering a retry that reads it again', async () => {
    await openRecipe({
      readFails: true,
      rereads: [recordMock(GetRecipeDocument, { held: true })],
    });

    await userEvent.setup().press(screen.getByText(t('labels.tryAgain')));

    await expect(log.requested(GetRecipeDocument, 2)).resolves.toBeUndefined();
  });

  it('says offline that it needs the connection', async () => {
    useStore.setState({ apiReachable: false });
    await openRecipe({ readFails: true });

    expect(screen.getByTestId(kitTestIDs.stateOffline)).toBeTruthy();
  });

  it('keeps one on screen while it is read again', async () => {
    await openRecipe({
      rereads: [recordMock(GetRecipeDocument, { held: true })],
    });

    pull();
    await log.requested(GetRecipeDocument, 2);

    expect(screen.getAllByText('Lasagna').length).toBeGreaterThan(0);
  });
});

describe('its source', () => {
  it('says so when its link cannot be opened', async () => {
    await openRecipe({
      recipe: recipeRead({ source: 'Grandma', sourceUrl: 'notaurl' }),
    });

    expect(
      screen.getByText(t('recipes.recipeFrom', { source: 'Grandma' })),
    ).toBeTruthy();
    await userEvent
      .setup()
      .press(screen.getByText(t('recipes.viewOriginalRecipe')));

    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      t('errors.linkNotOpenable'),
    );
  });
});

describe('its ingredients', () => {
  const GARLIC = recipeIngredientRead('ing-1', 'Garlic');
  const ONION = recipeIngredientRead('ing-2', 'Onion');
  const WITH_BOTH = recipeRead({ ingredients: [GARLIC, ONION] });

  const lineIdsOf = (variables: Record<string, unknown>) => {
    const items: unknown = inputOf(variables).items;
    return Array.isArray(items)
      ? items.flatMap(item =>
          isRecord(item) && typeof item.id === 'string' ? [item.id] : [],
        )
      : [];
  };
  const listedAnswer = () =>
    recordMock(AddItemsToShoppingListFromRecipeDocument, {
      dataFor: (
        variables,
      ): MockDataFor<typeof AddItemsToShoppingListFromRecipeDocument> => ({
        addItemsToShoppingList: {
          __typename: 'AddItemsToShoppingListPayload',
          results: lineIdsOf(variables).map(id => ({
            __typename: 'BatchAddShoppingListItemResult',
            success: true,
            item: { __typename: 'ShoppingListItem', id },
          })),
        },
      }),
    });

  beforeEach(() => {
    useStore.setState({ selectedShoppingListId: 'list-1' });
  });

  it('adds one to the list on a tap, then says it is on the list', async () => {
    const added = listedAnswer();
    await openRecipe({ recipe: WITH_BOTH, answers: [added] });

    await userEvent
      .setup()
      .press(screen.getByTestId(recipesTestIDs.ingredientTile(0)));
    await log.landed(AddItemsToShoppingListFromRecipeDocument);

    expect(added.fired).toHaveLength(1);
    expect(
      screen.getByTestId(recipesTestIDs.ingredientTile(0)).props
        .accessibilityLabel,
    ).toContain(t('labels.onYourList'));
  });

  it('opens what a flagged one means for the household instead of adding it', async () => {
    const added = recordMock(AddItemsToShoppingListFromRecipeDocument, {
      held: true,
    });
    await openRecipe({
      recipe: WITH_BOTH,
      answers: [
        added,
        recordMock(RecipeDietaryAlertsDocument, {
          data: {
            recipe: {
              __typename: 'Recipe',
              version: 1,
              id: 'recipe-1',
              ingredientsConnection: {
                __typename: 'RecipeIngredientConnection',
                edges: [
                  {
                    __typename: 'RecipeIngredientEdge',
                    node: {
                      __typename: 'RecipeIngredient',
                      id: 'ing-1',
                      dietaryAlerts: [
                        {
                          __typename: 'DietaryAlert',
                          state: DietaryAlertState.Contains,
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        }),
      ],
    });
    await log.landed(RecipeDietaryAlertsDocument);

    await userEvent
      .setup()
      .press(screen.getByTestId(recipesTestIDs.ingredientTile(0)));

    expect(added.fired).toEqual([]);
  });

  it.each([
    [
      'only what the pantry lacks',
      ['ing-2'],
      t('recipes.addMissing', { count: 1 }),
    ],
    ['all of them when it lacks all', ['ing-1', 'ing-2'], t('recipes.addAll')],
  ])('offers to add %s', async (_, lacked, offered) => {
    await openRecipe({
      recipe: WITH_BOTH,
      answers: [missing(lacked)],
    });
    await log.landed(RecipeMissingIngredientsDocument);

    expect(screen.getByText(offered)).toBeTruthy();
  });

  it('names a new list after the recipe', async () => {
    await openRecipe({
      recipe: WITH_BOTH,
      answers: [missing(['ing-1', 'ing-2'])],
    });
    await log.landed(RecipeMissingIngredientsDocument);
    const user = userEvent.setup();

    await user.press(screen.getByText(t('recipes.addAll')));
    await user.press(screen.getByText(t('shoppingListPicker.newList')));

    expect(
      screen.getByPlaceholderText(
        t('shoppingListPicker.newListNamePlaceholder'),
      ).props.value,
    ).toBe('Lasagna');
  });

  it('offers no add when the pantry holds them all', async () => {
    await openRecipe({ recipe: WITH_BOTH, answers: [missing([])] });
    await log.landed(RecipeMissingIngredientsDocument);

    expect(screen.queryByText(t('recipes.addAll'))).not.toBeOnTheScreen();
    expect(
      screen.queryByText(t('recipes.addMissing', { count: 0 })),
    ).not.toBeOnTheScreen();
  });
});

/** The ingredients the pantry lacks, as the API answers. */
const missing = (ids: string[]) =>
  recordMock(RecipeMissingIngredientsDocument, {
    data: missingAnswer(ids),
  });

const missingAnswer = (
  ids: string[],
): MockDataFor<typeof RecipeMissingIngredientsDocument> => ({
  recipe: {
    __typename: 'Recipe',
    version: 1,
    id: 'recipe-1',
    missingIngredientsConnection: {
      __typename: 'RecipeIngredientConnection',
      edges: ids.map(id => ({
        __typename: 'RecipeIngredientEdge',
        node: { __typename: 'RecipeIngredient', id },
      })),
    },
  },
});

describe('a catalog recipe', () => {
  const PHO = {
    provider: ExternalSource.Spoonacular,
    externalId: '999',
    name: 'Pho',
    imageUrl: null,
  };
  const opened = (
    recipe: ReturnType<typeof recipeRead>,
    options: { held?: boolean; maxUsageCount?: number } = {},
  ) =>
    recordMock(OpenCatalogRecipeDocument, {
      ...options,
      data: {
        upsertExternalRecipe: {
          __typename: 'UpsertExternalRecipePayload',
          recipe,
          created: true,
        },
      },
    });
  const PHO_READ = recipeRead({
    id: 'recipe-9',
    name: 'Pho',
    isExternal: true,
    createdBy: null,
  });
  const awaitingFetch = (syncStatus: ExternalSyncStatus) =>
    recipeRead({
      ...PHO_READ,
      sourceMapping: {
        __typename: 'RecipeSourceMapping',
        id: 'map-1',
        syncStatus,
      },
    });
  const cannotOpen = () =>
    recordMock(OpenCatalogRecipeDocument, {
      error: new Error('Network request failed'),
    });

  it('shows its row while the API opens it, then reads the recipe it opened', async () => {
    const open = opened(PHO_READ, { held: true });
    await openRecipe({
      params: { catalog: PHO },
      recipe: PHO_READ,
      answers: [open],
      awaitRead: false,
    });
    await log.requested(OpenCatalogRecipeDocument);
    expect(screen.getAllByText('Pho').length).toBeGreaterThan(0);
    // Reviews belong to a recipe the API holds.
    expect(screen.queryByText(t('recipes.reviews'))).not.toBeOnTheScreen();

    open.release();
    await log.landed(OpenCatalogRecipeDocument);
    // The open settles a few promise turns after its answer lands.
    await act(async () => undefined);

    // The open answers with the recipe, which the screen then reads by its id.
    expect(
      screen.getByText(t('labels.servingsCount', { count: 4 })),
    ).toBeTruthy();
    expect(open.fired).toHaveLength(1);
  });

  it('says why it could not be opened', async () => {
    await openRecipe({
      params: { catalog: PHO },
      answers: [cannotOpen()],
      awaitRead: false,
    });
    await log.landed(OpenCatalogRecipeDocument);
    // The open settles a few promise turns after its answer lands.
    await act(async () => undefined);

    expect(screen.getByText(t('labels.tryAgain'))).toBeTruthy();
    expect(
      screen.queryByText(t('recipes.recipeNotFound')),
    ).not.toBeOnTheScreen();
  });

  it('reads the recipe this device opened before while the API opens it again', async () => {
    recordOpenedCatalogRecipe(PHO, 'recipe-9');
    await openRecipe({
      params: { catalog: PHO },
      recipe: PHO_READ,
      answers: [opened(PHO_READ, { held: true })],
    });

    expect(
      screen.getByText(t('labels.servingsCount', { count: 4 })),
    ).toBeTruthy();
  });

  it('reads the recipe this device opened before when the API cannot open it now', async () => {
    recordOpenedCatalogRecipe(PHO, 'recipe-9');
    await openRecipe({
      params: { catalog: PHO },
      recipe: PHO_READ,
      answers: [cannotOpen()],
    });
    await log.landed(OpenCatalogRecipeDocument);
    await act(async () => undefined);

    expect(
      screen.getByText(t('labels.servingsCount', { count: 4 })),
    ).toBeTruthy();
    expect(screen.queryByText(t('labels.tryAgain'))).not.toBeOnTheScreen();
  });

  it("never reads another provider's recipe with the same id for it", async () => {
    recordOpenedCatalogRecipe(
      { provider: ExternalSource.Edamam, externalId: PHO.externalId },
      'recipe-9',
    );
    const { read } = await openRecipe({
      params: { catalog: PHO },
      recipe: PHO_READ,
      answers: [opened(PHO_READ, { held: true })],
      awaitRead: false,
    });
    await log.requested(OpenCatalogRecipeDocument);

    // A recipe the device found would be read as the screen mounts.
    expect(read.fired).toEqual([]);
  });

  it("carries the row's photo into its hero while it opens", async () => {
    await openRecipe({
      params: { catalog: { ...PHO, imageUrl: 'https://img.example/pho.jpg' } },
      answers: [opened(PHO_READ, { held: true })],
      awaitRead: false,
    });
    await log.requested(OpenCatalogRecipeDocument);

    expect(
      screen.UNSAFE_getByProps({ sharedTransitionTag: 'recipe-image-999' }),
    ).toBeTruthy();
  });

  it.each([
    [
      'saved, waits without being asked to save',
      true,
      'recipes.catalogPendingSavedSubtitle',
    ],
    ['not saved, asks to be saved', false, 'recipes.catalogPendingSubtitle'],
  ] as const)('not yet fetched and %s', async (_, isSaved, said) => {
    await openRecipe({
      recipe: recipeRead({
        isExternal: true,
        createdBy: null,
        sourceMapping: {
          __typename: 'RecipeSourceMapping',
          id: 'map-1',
          syncStatus: ExternalSyncStatus.Pending,
        },
        savedDetails: isSaved ? savedDetails() : null,
      }),
    });

    expect(screen.getByText(t(said))).toBeTruthy();
    // Only a whole recipe can be forked.
    expect(headerOffers(recipesTestIDs.forkButton)).toBe(false);
  });

  it.each([
    ['not yet fetched', ExternalSyncStatus.Pending],
    ['its source could not find', ExternalSyncStatus.NotFound],
  ])('is opened again on a pull while %s', async (_, syncStatus) => {
    await openRecipe({
      params: { catalog: PHO },
      recipe: awaitingFetch(syncStatus),
      answers: [opened(awaitingFetch(syncStatus))],
      awaitRead: false,
    });
    await log.landed(OpenCatalogRecipeDocument);
    // The open settles a few promise turns after its answer lands.
    await act(async () => undefined);

    pull();

    await log.landed(OpenCatalogRecipeDocument, 2);
    await act(async () => undefined);
  });

  it('keeps one not yet fetched on screen when opening it again fails', async () => {
    const stub = awaitingFetch(ExternalSyncStatus.Pending);
    await openRecipe({
      params: { catalog: PHO },
      recipe: stub,
      answers: [opened(stub, { maxUsageCount: 1 }), cannotOpen()],
      awaitRead: false,
    });
    await log.landed(OpenCatalogRecipeDocument);
    await act(async () => undefined);

    pull();
    await log.landed(OpenCatalogRecipeDocument, 2);
    await act(async () => undefined);

    expect(screen.getByText(t('recipes.catalogPendingSubtitle'))).toBeTruthy();
    expect(screen.queryByText(t('labels.tryAgain'))).not.toBeOnTheScreen();
  });

  it('reads one opened by its id again on a pull, never opening it from its row', async () => {
    const stub = awaitingFetch(ExternalSyncStatus.Pending);
    const open = recordMock(OpenCatalogRecipeDocument, { held: true });
    await openRecipe({
      params: { recipeId: 'recipe-9', catalog: PHO },
      recipe: stub,
      answers: [open],
      rereads: [recordMock(GetRecipeDocument, { data: { recipe: stub } })],
    });

    pull();
    await log.landed(GetRecipeDocument, 2);

    expect(open.fired).toEqual([]);
  });
});
