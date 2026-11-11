import React, { useEffect } from 'react';
import { RefreshControl } from 'react-native';
import {
  act,
  fireEvent,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { FlashList } from '@shopify/flash-list';
import { makeCache } from '#/apollo/cache';
import { isRecord } from '#/utils/isRecord';
import {
  recordMock,
  renderWithApollo,
  seedQuery,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { withDeadline } from '#/test-utils/cacheWaits';
import { homesWithRole } from '#/test-utils/fixtures/homeFixtures';
import { pantryData } from '#/test-utils/fixtures/pantryFixtures';
import { useStore } from '#store';
import { t } from '#/i18n';
import { Telemetry } from '#services/telemetry';
import {
  Diet,
  ExternalSource,
  FeatureFlagName,
  Intolerance,
  MembershipRole,
} from '#/graphql/generated/schemaTypes';
import { GetHomesDocument } from '#operations/home/home.generated';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';
import { GetDietaryProfileDocument } from '#operations/user/user.generated';
import { MyFeatureFlagsDocument } from '#operations/user/featureFlags.generated';
import {
  CatalogRecipesByIngredientsDocument,
  RandomCatalogRecipesDocument,
} from '#features/recipes/hooks/useCatalogDiscovery.generated';
import { SearchRecipesDocument } from '#features/recipes/hooks/useRecipeSearch.generated';
import { noteTipFact } from '#hooks/settings/useFeatureHint';
import {
  startTutorialSession,
  tutorialSession,
} from '#hooks/ui/tutorialSession';
import { GUIDE_TOURS } from '#domain/guides';
import {
  TabBarActionsProvider,
  useTabBarSetters,
  useTabBarState,
  type TabBarAddAction,
} from '#/context/TabBarActionsContext';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { useRecipeCaptureStore } from '#features/recipes/store/recipeCaptureStore';
import { RecipeCaptureDocument } from '#features/recipes/hooks/useRecipeCapture.generated';
import { kitTestIDs } from '#components/testIDs';
import { RecipeMain } from '../RecipeMain';

jest.mock('#hooks/navigation/useAppNavigation');
// Navigation is the boundary: no navigator, so the tab counts as focused.
jest.mock('@react-navigation/native', () => {
  const { useEffect: useMountEffect } = jest.requireActual('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (effect: () => undefined | (() => void)) =>
      useMountEffect(effect, [effect]),
    useIsFocused: () => true,
  };
});
// Jest lays nothing out, so a measured target reports a fixed rect.
jest.mock('#hooks/ui/useMeasuredRect', () => {
  const { useEffect: useMountEffect } = jest.requireActual('react');
  return {
    useMeasuredRect: (
      onMeasure?: (rect: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) => void,
    ) => {
      useMountEffect(() => {
        onMeasure?.({ x: 16, y: 120, width: 300, height: 40 });
      }, [onMeasure]);
      return { ref: { current: null }, measure: () => undefined };
    },
  };
});

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const ME = 'user-1';

/** What the shell's tab bar reads from the screen. */
const shell: { addMenu?: readonly TabBarAddAction[] } = {};
function TabBar() {
  const { setActiveTab, setAddButtonRect } = useTabBarSetters();
  const { addMenu } = useTabBarState();
  useEffect(() => {
    setActiveTab('Recipe');
    setAddButtonRect({ x: 300, y: 760, width: 56, height: 56 });
  }, [setActiveTab, setAddButtonRect]);
  useEffect(() => {
    shell.addMenu = addMenu;
  });
  return null;
}

type CatalogNode = {
  __typename: 'CatalogRecipeHit';
  provider: ExternalSource;
  providerRecipeId: string;
  name: string;
  imageUrl: string | null;
  servings: number;
  totalTimeMinutes: number | null;
  likes: number;
};

const recipe = (id: string, name: string): CatalogNode => ({
  __typename: 'CatalogRecipeHit',
  provider: ExternalSource.Spoonacular,
  providerRecipeId: id,
  name,
  imageUrl: `https://img.example.com/${id}.jpg`,
  servings: 4,
  totalTimeMinutes: 30,
  likes: 10,
});

const SOUP = recipe('101', 'Tomato soup');
const STEW = recipe('102', 'Bean stew');

const randomAnswer = (
  nodes: CatalogNode[],
): MockDataFor<typeof RandomCatalogRecipesDocument> => ({
  randomCatalogRecipes: {
    __typename: 'CatalogRecipeConnection',
    edges: nodes.map(node => ({
      __typename: 'CatalogRecipeEdge',
      cursor: node.providerRecipeId,
      node,
    })),
    catalogAvailable: true,
  },
});

const pantryAnswer = (
  nodes: CatalogNode[],
): MockDataFor<typeof CatalogRecipesByIngredientsDocument> => ({
  catalogRecipesByIngredients: {
    __typename: 'CatalogRecipeMatchConnection',
    edges: nodes.map(node => ({
      __typename: 'CatalogRecipeMatchEdge',
      cursor: node.providerRecipeId,
      usedIngredientCount: 2,
      missedIngredientCount: 1,
      node,
    })),
    catalogAvailable: true,
  },
});

type Restriction = NonNullable<
  NonNullable<
    NonNullable<
      MockDataFor<typeof GetDietaryProfileDocument>['me']
    >['dietaryProfile']
  >['restrictions']
>[number];
type FlagState = NonNullable<
  MockDataFor<typeof MyFeatureFlagsDocument>['myFeatureFlags']
>[number];

let log = operationLog();

interface Visit {
  /** What the pantry holds; none means an empty pantry and random recipes. */
  pantry?: string[];
  /** The discovery read's answer. */
  found?: CatalogNode[];
  /** The discovery read is held until released. */
  held?: boolean;
  /** The person's own diet, which seeds the filters. */
  profile?: {
    diets?: Diet[];
    intolerances?: Intolerance[];
    maxCookTimeMinutes?: number | null;
  };
  /** Server flags switched on for the person. */
  flags?: FeatureFlagName[];
  answers?: ReturnType<typeof recordMock>[];
  /** Answers to discovery's later reads; the first read is answered once. */
  then?: ReturnType<typeof recordMock>[];
}

/** The recipes tab as HomeTabs mounts it, its discovery read answered. */
async function openRecipes({
  pantry = [],
  found = [SOUP, STEW],
  held = false,
  profile = {},
  flags = [],
  answers = [],
  then = [],
}: Visit = {}) {
  const cache = makeCache();
  // The app reads the homes before any tab mounts; the tabs read them cache-only.
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
  const discovery =
    pantry.length > 0
      ? recordMock(CatalogRecipesByIngredientsDocument, {
          data: pantryAnswer(found),
          held,
          maxUsageCount: then.length > 0 ? 1 : undefined,
        })
      : recordMock(RandomCatalogRecipesDocument, {
          data: randomAnswer(found),
          held,
          maxUsageCount: then.length > 0 ? 1 : undefined,
        });
  const pantryRead = recordMock(GetPantryDocument, {
    data: pantryData({
      id: 'p1',
      name: 'Kitchen',
      items: pantry.map((itemName, index) => ({
        id: `item-${index}`,
        itemName,
      })),
    }),
    maxUsageCount: 10,
  });
  renderWithApollo(
    <TabBarActionsProvider>
      <TabBar />
      <RecipeMain />
    </TabBarActionsProvider>,
    {
      cache,
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        discovery.mock,
        ...then.map(answer => answer.mock),
        pantryRead.mock,
        recordMock(GetDietaryProfileDocument, {
          data: {
            me: {
              __typename: 'User',
              id: ME,
              dietaryProfile: {
                __typename: 'DietaryProfile',
                id: 'profile-1',
                userId: ME,
                maxCookTimeMinutes: profile.maxCookTimeMinutes ?? null,
                restrictions: [
                  ...(profile.diets ?? []).map(
                    (diet): Restriction => ({
                      __typename: 'DietaryRestriction',
                      id: `diet-${diet}`,
                      diet,
                      intolerance: null,
                    }),
                  ),
                  ...(profile.intolerances ?? []).map(
                    (intolerance): Restriction => ({
                      __typename: 'DietaryRestriction',
                      id: `intolerance-${intolerance}`,
                      diet: null,
                      intolerance,
                    }),
                  ),
                ],
              },
            },
          },
        }).mock,
        recordMock(MyFeatureFlagsDocument, {
          data: {
            myFeatureFlags: flags.map(
              (flag): FlagState => ({
                __typename: 'FeatureFlagState',
                flag,
                enabled: true,
              }),
            ),
          },
        }).mock,
      ],
    },
  );
  await log.requested(
    pantry.length > 0
      ? CatalogRecipesByIngredientsDocument
      : RandomCatalogRecipesDocument,
  );
  await log.landed(GetDietaryProfileDocument);
  if (!held) {
    await log.landed(
      pantry.length > 0
        ? CatalogRecipesByIngredientsDocument
        : RandomCatalogRecipesDocument,
    );
  }
  return { cache, discovery };
}

/**
 * What gorhom tells a sheet once it has opened, which the stand-in never does:
 * its `onChange` with the first snap point.
 */
function sheetOpened(title: string) {
  let node: ReturnType<typeof screen.getByText> | null =
    screen.getByText(title);
  while (node && typeof node.props.onChange !== 'function') node = node.parent;
  const onChange: unknown = node?.props.onChange;
  if (typeof onChange !== 'function')
    throw new Error(`no sheet titled ${title}`);
  act(() => {
    onChange(0);
  });
}

/** The list showing a row titled `title`, as FlashList is handed it. */
const listShowing = (title: string) => {
  const list = screen.UNSAFE_getAllByType(FlashList).find(candidate => {
    const rows: unknown = candidate.props.data;
    return (
      Array.isArray(rows) &&
      rows.some(row => isRecord(row) && row.title === title)
    );
  });
  if (!list) throw new Error(`no list shows ${title}`);
  return list;
};

const searchFor = (query: string) => {
  fireEvent.changeText(screen.getByTestId(recipesTestIDs.searchInput), query);
  fireEvent(screen.getByTestId(recipesTestIDs.searchInput), 'submitEditing');
};

const searchAnswer = (
  names: string[],
  { hasNextPage = false }: { hasNextPage?: boolean } = {},
): MockDataFor<typeof SearchRecipesDocument> => ({
  findRecipes: {
    __typename: 'RecipeSearchConnection',
    edges: names.map((name, index) => ({
      __typename: 'RecipeSearchEdge',
      cursor: `c-${index}`,
      node: {
        __typename: 'Recipe',
        version: 1,
        id: `recipe-${index}`,
        name,
        imageUrl: null,
        servings: 4,
        totalTimeMinutes: 20,
        diets: [],
        freeOf: [],
        isSaved: false,
      },
    })),
    pageInfo: {
      __typename: 'PageInfo',
      hasNextPage,
      endCursor: hasNextPage ? `c-${names.length - 1}` : null,
    },
    catalogAvailable: true,
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  shell.addMenu = undefined;
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
    showTutorials: true,
    // Tips on, none seen yet, and nothing done that a tip waits for.
    featureHintsShown: {},
    lastUnpromptedTipAt: {},
    tipFacts: {},
  });
  // The + menu belongs to the tab navigation says is focused.
  mockNav.navigation.getState.mockReturnValue({
    type: 'tab',
    index: 0,
    routes: [{ name: 'Recipe' }],
  });
  tutorialSession.endGuide(GUIDE_TOURS.cook);
  startTutorialSession();
});

describe('the recipes tab', () => {
  it('offers recipe ideas to an empty pantry, searched by name only', async () => {
    await openRecipes();

    expect(screen.getByText(t('recipes.needInspiration'))).toBeTruthy();
    expect(screen.getByText('Tomato soup')).toBeTruthy();
    expect(
      screen.queryByTestId(recipesTestIDs.searchModeTab('ingredients')),
    ).not.toBeOnTheScreen();
    expect(
      screen.getByLabelText(t('recipes.dietaryRestrictions')),
    ).toBeTruthy();
  });

  it('offers what the pantry can make, searched by name or by ingredient', async () => {
    await openRecipes({ pantry: ['Tomato', 'Beans'] });

    expect(screen.getByText(t('recipes.basedOnPantry'))).toBeTruthy();
    expect(screen.getByText('Bean stew')).toBeTruthy();
    expect(
      screen.getByTestId(recipesTestIDs.searchModeTab('ingredients')),
    ).toBeTruthy();
  });

  it("opens a recipe with the row's own title and image", async () => {
    await openRecipes();

    fireEvent.press(screen.getByText('Tomato soup'));

    expect(mockNav.toRecipeDetail).toHaveBeenCalledWith({
      catalog: {
        provider: ExternalSource.Spoonacular,
        externalId: '101',
        name: 'Tomato soup',
        imageUrl: 'https://img.example.com/101.jpg',
      },
    });
  });

  it('opens Saved and My recipes from its header', async () => {
    await openRecipes();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText(t('recipes.savedRecipes')));
    await user.press(screen.getByLabelText(t('recipes.myRecipes')));

    expect(mockNav.toSavedRecipes).toHaveBeenCalledTimes(1);
    expect(mockNav.toMyRecipes).toHaveBeenCalledTimes(1);
  });

  it('writes a recipe from the + menu', async () => {
    await openRecipes();

    act(() => {
      shell.addMenu?.find(action => action.key === 'manual')?.onPress();
    });

    expect(mockNav.toRecipeCreate).toHaveBeenCalledTimes(1);
  });

  it('says so when there is nothing to suggest', async () => {
    await openRecipes({ found: [] });

    expect(screen.getByText(t('recipes.discoverTitle'))).toBeTruthy();
  });
});

describe('a search by name', () => {
  const searched = (
    names: string[],
    options?: { hasNextPage?: boolean; held?: boolean },
  ) =>
    recordMock(SearchRecipesDocument, {
      data: searchAnswer(names, options),
      held: options?.held,
    });

  it('lists what it found under a count, and clears back to the ideas', async () => {
    await openRecipes({ answers: [searched(['Lasagna'])] });

    searchFor('lasagna');
    await log.landed(SearchRecipesDocument);

    expect(
      screen.getByText(t('recipes.resultSingular', { count: 1 })),
    ).toBeTruthy();
    expect(screen.getByText('Lasagna')).toBeTruthy();
    expect(
      screen.queryByText(t('recipes.needInspiration')),
    ).not.toBeOnTheScreen();

    await userEvent
      .setup()
      .press(screen.getByLabelText(t('recipes.clearSearch')));

    expect(screen.getByTestId(recipesTestIDs.searchInput).props.value).toBe('');
    expect(screen.getByText(t('recipes.needInspiration'))).toBeTruthy();
  });

  it('counts several results as several', async () => {
    await openRecipes({ answers: [searched(['Lasagna', 'Lentil soup'])] });

    searchFor('l');
    await log.landed(SearchRecipesDocument);

    expect(
      screen.getByText(t('recipes.resultPlural', { count: 2 })),
    ).toBeTruthy();
  });

  it('opens a recipe the API holds by its id, with its own title', async () => {
    await openRecipes({ answers: [searched(['Lasagna'])] });

    searchFor('lasagna');
    await log.landed(SearchRecipesDocument);
    fireEvent.press(screen.getByText('Lasagna'));

    // Its own title shows while the recipe is read.
    expect(mockNav.toRecipeDetail).toHaveBeenCalledWith({
      recipeId: 'recipe-0',
      row: { name: 'Lasagna', imageUrl: undefined },
    });
  });

  it('shows no stale rows while it is out', async () => {
    await openRecipes({ answers: [searched(['Lasagna'], { held: true })] });

    searchFor('lasagna');
    await log.requested(SearchRecipesDocument);

    expect(screen.queryByText('Tomato soup')).not.toBeOnTheScreen();
  });

  it("shows none of the last search's rows while the next is out", async () => {
    await openRecipes({
      answers: [
        recordMock(SearchRecipesDocument, {
          data: searchAnswer(['Lasagna']),
          maxUsageCount: 1,
        }),
        recordMock(SearchRecipesDocument, {
          data: searchAnswer(['Lentil soup']),
          held: true,
        }),
      ],
    });
    searchFor('lasagna');
    await log.landed(SearchRecipesDocument);

    searchFor('lentil');
    await log.requested(SearchRecipesDocument, 2);

    expect(screen.queryByText('Lasagna')).not.toBeOnTheScreen();
  });

  it('reads its next page at the end of the list', async () => {
    const pages = searched(['Lasagna', 'Lentil soup'], { hasNextPage: true });
    await openRecipes({ answers: [pages] });

    searchFor('l');
    await log.landed(SearchRecipesDocument);
    fireEvent(listShowing('Lasagna'), 'endReached');
    await log.requested(SearchRecipesDocument, 2);

    expect(pages.fired.at(-1)).toMatchObject({ after: 'c-1' });
  });
});

describe('the diet filter', () => {
  const VEGETARIAN = {
    diets: [Diet.Vegetarian],
    intolerances: [Intolerance.Dairy],
    maxCookTimeMinutes: 30,
  };

  it("counts what the person's diet sets, and says how many", async () => {
    await openRecipes({ profile: VEGETARIAN });

    const control = screen.getByLabelText(
      t('a11y.counterValue', {
        label: t('recipes.dietaryRestrictions'),
        value: t('recipes.filtersActiveSummary', { count: 3 }),
      }),
    );
    expect(within(control).getByText('3')).toBeTruthy();
  });

  it('names no count with no filter set', async () => {
    await openRecipes();

    const control = screen.getByLabelText(t('recipes.dietaryRestrictions'));
    expect(within(control).queryByText(/\d/)).not.toBeOnTheScreen();
  });

  it('lists its filters over a text search only', async () => {
    await openRecipes({
      profile: VEGETARIAN,
      answers: [
        recordMock(SearchRecipesDocument, { data: searchAnswer(['Lasagna']) }),
      ],
    });
    expect(
      screen.queryByTestId(recipesTestIDs.activeFiltersSummary),
    ).not.toBeOnTheScreen();

    searchFor('lasagna');
    await log.landed(SearchRecipesDocument);

    expect(
      screen.getByTestId(recipesTestIDs.activeFiltersSummary),
    ).toBeTruthy();
  });
});

describe('what the pantry can make', () => {
  it('is read again on request, the rows staying, with no second request meanwhile', async () => {
    await openRecipes({
      pantry: ['Tomato', 'Beans'],
      then: [
        recordMock(CatalogRecipesByIngredientsDocument, {
          data: pantryAnswer([STEW]),
          held: true,
        }),
      ],
    });

    await userEvent
      .setup()
      .press(screen.getByLabelText(t('recipes.refreshSuggestions')));
    await log.requested(CatalogRecipesByIngredientsDocument, 2);

    expect(
      screen.getByLabelText(t('recipes.refreshSuggestions')),
    ).toBeDisabled();
    expect(screen.getByText('Bean stew')).toBeTruthy();
  });

  it('is read again on a pull', async () => {
    await openRecipes({ pantry: ['Tomato', 'Beans'] });

    act(() => {
      screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });

    await expect(
      log.requested(CatalogRecipesByIngredientsDocument, 2),
    ).resolves.toBeUndefined();
  });

  it('shows a further screenful at the end of the list', async () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      recipe(String(200 + index), `Recipe ${index}`),
    );
    await openRecipes({ pantry: ['Tomato'], found: many });
    expect(listShowing('Recipe 0').props.data).toHaveLength(15);

    fireEvent(listShowing('Recipe 0'), 'endReached');

    expect(listShowing('Recipe 0').props.data).toHaveLength(20);
  });
});

describe('the search modes', () => {
  it('swap the filter for the pantry picker, which names what was picked', async () => {
    await openRecipes({ pantry: ['Tomato', 'Beans'] });
    const user = userEvent.setup();

    await user.press(
      screen.getByTestId(recipesTestIDs.searchModeTab('ingredients')),
    );
    expect(
      screen.queryByLabelText(t('recipes.dietaryRestrictions')),
    ).not.toBeOnTheScreen();
    await user.press(screen.getByTestId(recipesTestIDs.ingredientPicker));
    await user.press(screen.getByText('Tomato'));

    expect(screen.getByLabelText('Tomato')).toBeTruthy();
  });

  it("tell the pantry's suggestions that filters apply only to text search", async () => {
    await openRecipes({ pantry: ['Tomato', 'Beans'] });

    await userEvent
      .setup()
      .press(screen.getByLabelText(t('recipes.dietaryRestrictions')));
    sheetOpened(t('recipeFilters.title'));

    expect(screen.getByText(t('recipeFilters.infoBanner'))).toBeTruthy();
  });

  // Picks survive a switch back to name search, where filters do apply.
  it('never tell a name search that filters apply only to text search', async () => {
    await openRecipes({
      pantry: ['Tomato', 'Beans'],
      answers: [
        recordMock(SearchRecipesDocument, { data: searchAnswer(['Lasagna']) }),
      ],
    });
    const user = userEvent.setup();
    await user.press(
      screen.getByTestId(recipesTestIDs.searchModeTab('ingredients')),
    );
    await user.press(screen.getByTestId(recipesTestIDs.ingredientPicker));
    await user.press(screen.getByText('Tomato'));
    await user.press(screen.getByTestId(recipesTestIDs.searchModeTab('name')));
    searchFor('lasagna');
    await log.landed(SearchRecipesDocument);

    await user.press(screen.getByLabelText(t('recipes.dietaryRestrictions')));
    sheetOpened(t('recipeFilters.title'));

    expect(screen.getByText(t('labels.diet'))).toBeTruthy();
    expect(
      screen.queryByText(t('recipeFilters.infoBanner')),
    ).not.toBeOnTheScreen();
  });

  // An empty ingredient search would otherwise stay on screen in name mode.
  it("drop the other mode's search on a switch", async () => {
    await openRecipes({
      pantry: ['Tomato', 'Beans'],
      answers: [
        recordMock(SearchRecipesDocument, { data: searchAnswer(['Lasagna']) }),
      ],
    });
    const user = userEvent.setup();
    searchFor('lasagna');
    await log.landed(SearchRecipesDocument);

    await user.press(
      screen.getByTestId(recipesTestIDs.searchModeTab('ingredients')),
    );
    await user.press(screen.getByTestId(recipesTestIDs.searchModeTab('name')));

    expect(screen.queryByText('Lasagna')).not.toBeOnTheScreen();
    expect(screen.getByText(t('recipes.basedOnPantry'))).toBeTruthy();
  });
});

/** Resolves when a tour shows the step, the signal its spotlight is up. */
const stepViewed = (featureId: string) =>
  withDeadline(
    done => {
      jest.mocked(Telemetry.trackEvent).mockImplementation((name, props) => {
        if (name === 'tour_step_viewed' && props?.feature_id === featureId) {
          done();
        }
      });
      return () => undefined;
    },
    () => `the tour never showed ${featureId}`,
  );

const pressTarget = () =>
  fireEvent.press(screen.getByTestId(kitTestIDs.spotlightTarget));

describe('the tips', () => {
  it('point at Saved once a recipe is saved, and open it from there', async () => {
    noteTipFact('recipeSaved');
    const viewed = stepViewed('recipe_tutorial_saved');
    await openRecipes();
    await viewed;

    pressTarget();

    expect(mockNav.toSavedRecipes).toHaveBeenCalledTimes(1);
  });

  it('point at My recipes once one is imported or written, and open it from there', async () => {
    noteTipFact('recipeAdded');
    const viewed = stepViewed('recipe_tutorial_my_recipes');
    await openRecipes();
    await viewed;

    pressTarget();

    expect(mockNav.toMyRecipes).toHaveBeenCalledTimes(1);
  });

  it('point at the pantry search, and open its picker from there', async () => {
    const viewed = stepViewed('recipe_tutorial_pantry');
    await openRecipes({ pantry: ['Tomato', 'Beans'] });
    await viewed;

    pressTarget();

    expect(screen.getByTestId(recipesTestIDs.ingredientPicker)).toBeTruthy();
  });
});

describe('the cook guide', () => {
  it('points at the suggestions, then opens the pantry search from its own step', async () => {
    act(() => {
      tutorialSession.startGuide(GUIDE_TOURS.cook);
    });
    const suggestions = stepViewed('cook_guide_suggestions');
    await openRecipes({ pantry: ['Tomato', 'Beans'] });
    await suggestions;
    expect(screen.getByText(t('recipes.cookGuideSuggestions'))).toBeTruthy();

    const pantry = stepViewed('recipe_tutorial_pantry');
    fireEvent.press(screen.getByTestId(kitTestIDs.spotlightPrimaryButton));
    await pantry;
    pressTarget();

    expect(screen.getByTestId(recipesTestIDs.ingredientPicker)).toBeTruthy();
  });

  it('says, started offline, that the suggestions wait for the connection', async () => {
    await openRecipes({ pantry: ['Tomato', 'Beans'] });
    await act(async () => {
      useStore.setState({ apiReachable: false });
    });

    const suggestions = stepViewed('cook_guide_suggestions');
    act(() => {
      tutorialSession.startGuide(GUIDE_TOURS.cook);
    });
    await suggestions;

    expect(screen.getByText(t('recipes.cookGuideOffline'))).toBeTruthy();
  });
});

describe('captures', () => {
  it('show the ones still reading above the ideas', async () => {
    useRecipeCaptureStore.setState({
      entries: [
        {
          id: 'capture-1',
          source: 'url',
          label: 'example.com',
          createdAt: new Date().toISOString(),
          state: 'reading',
          answered: true,
        },
      ],
    });
    await openRecipes({
      flags: [FeatureFlagName.RecipeCaptureUrl],
      answers: [recordMock(RecipeCaptureDocument, { held: true })],
    });

    expect(
      screen.getByText(
        t('recipes.captureReadingPage', { label: 'example.com' }),
      ),
    ).toBeTruthy();
  });
});
