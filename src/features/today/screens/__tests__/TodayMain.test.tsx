import React, { useEffect } from 'react';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { useStore } from '#store';
import { resetSessionScopedStores } from '#store/sessionScopedStores';
import { t } from '#/i18n';
import { CachedImage } from '#components/atoms/CachedImage';
import { kitTestIDs } from '#components/testIDs';
import { Screen } from '#components/templates/Screen';
import {
  TabBarActionsProvider,
  useTabBarSetters,
  type TabBarAddAction,
} from '#/context/TabBarActionsContext';
import { NativePerformanceService } from '#/services/performance/NativePerformanceService';
import * as tabBarAddMenu from '#hooks/navigation/useTabBarAddMenu';
import * as tutorialSequence from '#hooks/ui/useTutorialSequence';
import { tutorialSession } from '#hooks/ui/tutorialSession';
import { GUIDE_TOURS } from '#domain/guides';
import type { PendingTabAdd } from '#store/slices/uiSlice';
import { MealType } from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderWithApollo,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { connectionOf } from '#/test-utils/fixtures/connectionOf';
import {
  homesData,
  type HomeFixture,
} from '#/test-utils/fixtures/homeFixtures';
import { makeCache } from '#/apollo/cache';
import { GetHomesDocument } from '#operations/home/home.generated';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import {
  CurrentMealPlanDocument,
  GetMealPlanDocument,
} from '#features/mealPlan/screens/useMealPlan.generated';
import { RecipeSuggestionsDocument } from '#features/recipes/hooks/useServerRecipeSuggestions.generated';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { NotificationSummaryDocument } from '#features/notifications/graphql/notifications.generated';
import { todayTestIDs } from '#features/today/testIDs';
import { MealPlanItemCardSkeleton } from '#features/mealPlan/ui/MealPlanItemCardSkeleton';
import { ItemCardSkeleton } from '#components/molecules/ItemCardSkeleton';
import { TodayCountsDocument } from '../useTodayOverview.generated';
import { TodayMain } from '../TodayMain';

jest.mock('#hooks/navigation/useAppNavigation');
// The shared stand-in runs a focus effect during render, which loops a hook
// that sets state in one; here it runs after render, as React Navigation does.
jest.mock('@react-navigation/native', () => {
  const { useEffect: runAfterRender } =
    jest.requireActual<typeof import('react')>('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (effect: () => void | (() => void)) => {
      runAfterRender(effect);
    },
    useIsFocused: () => true,
    useNavigation: () => ({
      getState: () => undefined,
      getParent: () => undefined,
      navigate: jest.fn(),
      setOptions: jest.fn(),
      addListener: () => () => undefined,
    }),
  };
});
// The device's date: the meal plan below is for it.
jest.mock('#hooks/app/useToday', () => ({ useToday: () => '2026-03-10' }));
// Build flags: on, as in a build that ships these features.
jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(() => true),
}));
// The test renderer has no layout to measure; this reports a fixed rect so the
// wiring is what is under test.
const TITLE_RECT = { x: 16, y: 60, width: 140, height: 28 };
jest.mock('#hooks/ui/useMeasuredRect', () => ({
  useMeasuredRect: (
    onMeasure?: (rect: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => void,
  ) => ({
    ref: { current: null },
    measure: () => onMeasure?.({ x: 16, y: 60, width: 140, height: 28 }),
  }),
}));

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const TODAY = '2026-03-10';

let log = operationLog();

const KITCHEN_HOME: HomeFixture = {
  id: 'h1',
  name: 'Test Home',
  isDefault: true,
  pantries: [{ id: 'p1', name: 'Kitchen', isDefault: true }],
};
const CABIN: HomeFixture = { id: 'h2', name: 'Cabin', pantries: [] };

/** Signed in since before Getting started shipped, so the tiles show. */
const COOK = {
  id: 'u1',
  email: 'cook@example.com',
  emailVerified: true,
  onBoarded: true,
  createdAt: '2026-01-05T09:00:00Z',
};

const counts = (totalItems = 9, expired = 6, expiring = 3, held = false) =>
  recordMock(TodayCountsDocument, {
    held,
    dataFor: vars => ({
      pantry: {
        id: String(vars.id),
        stats: {
          totalItems,
          expiredCount: expired,
          expiringCount: expiring,
          lowStockCount: 0,
        },
      },
    }),
  });

const plans = (withPlan = true, held = false) =>
  recordMock(GetMealPlansDocument, {
    held,
    data: {
      mealPlans: connectionOf(
        withPlan
          ? [{ id: 'mp1', startDate: '2026-03-09', endDate: '2026-03-15' }]
          : [],
      ),
    },
  });

const MEALS = connectionOf([
  {
    id: 'mi1',
    date: TODAY,
    mealType: MealType.Dinner,
    customMealName: null,
    recipe: { id: 'r1', name: 'Shakshuka' },
  },
  {
    id: 'mi2',
    date: '2026-03-11',
    mealType: MealType.Lunch,
    customMealName: null,
    recipe: { id: 'r2', name: 'Soup' },
  },
]);

/** The plan covering today, or none; a failed read errors. */
const currentPlan = ({
  none = false,
  fails = false,
  held = false,
}: { none?: boolean; fails?: boolean; held?: boolean } = {}) =>
  fails
    ? recordMock(CurrentMealPlanDocument, {
        error: new Error('Network request failed'),
      })
    : recordMock(CurrentMealPlanDocument, {
        held,
        data: {
          currentMealPlan: none
            ? null
            : {
                id: 'mp1',
                startDate: '2026-03-09',
                endDate: '2026-03-15',
                mealPlanItemsConnection: MEALS,
              },
        },
      });

const plan = (fails = false) =>
  fails
    ? recordMock(GetMealPlanDocument, {
        error: new Error('Network request failed'),
      })
    : recordMock(GetMealPlanDocument, {
        data: {
          mealPlan: {
            id: 'mp1',
            startDate: '2026-03-09',
            endDate: '2026-03-15',
            mealPlanItemsConnection: connectionOf([
              {
                id: 'mi1',
                date: TODAY,
                mealType: MealType.Dinner,
                customMealName: null,
                recipe: { id: 'r1', name: 'Shakshuka' },
              },
              {
                id: 'mi2',
                date: '2026-03-11',
                mealType: MealType.Lunch,
                customMealName: null,
                recipe: { id: 'r2', name: 'Soup' },
              },
            ]),
          },
        },
      });

const suggestions = (count = 5, coverage = 80, held = false) =>
  recordMock(RecipeSuggestionsDocument, {
    held,
    data: {
      recipeSuggestions: {
        edges: Array.from({ length: count }, (_, index) => ({
          coverage,
          expiringStacks: [],
          node: { id: `s${index + 1}`, name: `Recipe ${index + 1}` },
        })),
      },
    },
  });

const lists = (withList = true) =>
  recordMock(GetShoppingListsLiteDocument, {
    data: {
      shoppingLists: connectionOf(
        withList
          ? [
              {
                id: 'l1',
                name: 'Weekly',
                isDefault: true,
                totalItems: 12,
                completedItems: 7,
              },
            ]
          : [],
      ),
    },
  });

/** What the tab bar's menus report: one open covers Today. */
let coverToday: (isOpen: boolean) => void = () => undefined;
function OverlayReporter() {
  const { setOverlayOpen } = useTabBarSetters();
  useEffect(() => {
    coverToday = setOverlayOpen;
  }, [setOverlayOpen]);
  return null;
}

interface Visit {
  answers?: ReturnType<typeof recordMock>[];
  unread?: number;
  /** The homes the device holds: the homes read is cache-only. */
  held?: HomeFixture[];
  selectedHomeId?: string | null;
}

const DEFAULT_ANSWERS = () => [
  currentPlan(),
  counts(),
  plans(),
  plan(),
  suggestions(),
  lists(),
];

async function openToday({
  answers = DEFAULT_ANSWERS(),
  unread = 0,
  held = [KITCHEN_HOME],
  selectedHomeId = 'h1',
}: Visit = {}) {
  const cache = makeCache();
  seedQuery(cache, { query: GetHomesDocument, data: homesData(held) });
  seedQuery(cache, {
    query: NotificationSummaryDocument,
    data: {
      notificationSummary: {
        __typename: 'NotificationSummary',
        id: 'summary',
        unreadCount: unread,
        hasUrgent: false,
      },
    },
  });
  act(() => {
    useStore.setState({
      selectedHomeId,
      selectedPantryId: selectedHomeId ? 'p1' : null,
      isHomeSelectionReady: true,
    });
  });
  const view = renderWithApollo(
    <TabBarActionsProvider>
      <OverlayReporter />
      <TodayMain />
    </TabBarActionsProvider>,
    {
      cache,
      links: [log.link],
      operationMocks: answers.map(answer => answer.mock),
    },
  );
  await act(async () => undefined);
  return view;
}

/** Waits for each read to land, in the order the screen asks them. */
const landed = async (...documents: Parameters<typeof log.landed>[0][]) => {
  for (const document of documents) await log.landed(document);
};

const everything = () =>
  landed(
    TodayCountsDocument,
    CurrentMealPlanDocument,
    RecipeSuggestionsDocument,
    GetShoppingListsLiteDocument,
  );

/** The actions Today hands the tab bar's +, as the hook is last given them. */
const watchAddMenu = () => {
  const spy = jest.spyOn(tabBarAddMenu, 'useTabBarAddMenu');
  return (): readonly TabBarAddAction[] => spy.mock.lastCall?.[0] ?? [];
};

/** The options Today hands its tutorial, as the hook is last given them. */
const watchTutorial = () => {
  const spy = jest.spyOn(tutorialSequence, 'useTutorialSequence');
  return () => spy.mock.lastCall?.[0];
};

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  log = operationLog();
  resetSessionScopedStores();
  useStore.setState({
    pendingTabAdd: null,
    selectedShoppingListId: null,
    user: COOK,
    isOnline: true,
    apiReachable: true,
  });
});

describe('header', () => {
  it('names the household and opens Home Management on it', async () => {
    await openToday();

    fireEvent.press(screen.getByTestId(todayTestIDs.householdTitle));

    expect(screen.getByText('Test Home')).toBeTruthy();
    expect(mockNav.toHomeManagement).toHaveBeenCalledWith({
      selectedHomeId: 'h1',
    });
  });

  it('offers notifications and Profile, marking unread ones on the bell', async () => {
    await openToday({ unread: 3 });

    expect(
      within(screen.getByTestId(todayTestIDs.notificationsButton)).getByText(
        '3',
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId(todayTestIDs.notificationsButton));
    fireEvent.press(screen.getByTestId(kitTestIDs.tab('Profile')));

    expect(mockNav.toNotifications).toHaveBeenCalled();
    expect(mockNav.toProfile).toHaveBeenCalled();
  });

  it("shows the user's photo for Profile, and the glyph without one", async () => {
    const profilePhoto = () =>
      within(screen.getByTestId(kitTestIDs.tab('Profile'))).UNSAFE_queryByType(
        CachedImage,
      )?.props.uri;
    useStore.setState({
      user: {
        id: 'u1',
        email: 'test@souschef.dev',
        emailVerified: true,
        onBoarded: true,
        profilePicture: 'https://example.com/me.jpg',
      },
    });
    await openToday();
    expect(profilePhoto()).toBe('https://example.com/me.jpg');

    act(() => {
      useStore.setState({ user: null });
    });

    expect(profilePhoto()).toBeUndefined();
  });
});

describe('status counts', () => {
  it("shows the pantry's three counts for today in order, a muted zero included", async () => {
    const asked = counts();
    await openToday({
      answers: [currentPlan(), asked, plans(), plan(), suggestions(), lists()],
    });
    await everything();

    const values = [
      todayTestIDs.statCard('expired'),
      todayTestIDs.statCard('expiring'),
      todayTestIDs.statCard('lowStock'),
    ].map(id => within(screen.getByTestId(id)).getAllByText(/^\d+$/)[0]);
    expect(values.map(node => node?.props.children)).toEqual(['6', '3', '0']);
    expect(asked.fired[0]).toMatchObject({ id: 'p1', today: TODAY });
  });

  it('opens the expired items from their card, and nothing from one at zero', async () => {
    await openToday();
    await everything();

    fireEvent.press(screen.getByTestId(todayTestIDs.statCard('lowStock')));
    fireEvent.press(screen.getByTestId(todayTestIDs.statCard('expired')));

    expect(mockNav.toFilteredPantryItems.mock.calls).toEqual([
      [{ mode: 'expired' }],
    ]);
  });
});

describe('Getting started', () => {
  // A new account: the card is first under the home's name, in place of the
  // tiles, and starts the next step's guide on its tab.
  it("takes the tiles' place for a new account, and starts the next step's guide", async () => {
    useStore.setState({
      user: {
        id: 'u1',
        email: 'new@souschef.dev',
        emailVerified: true,
        onBoarded: true,
        createdAt: '2026-11-11T09:00:00Z',
      },
    });
    const startGuide = jest.spyOn(tutorialSession, 'startGuide');
    await openToday();
    await everything();

    expect(screen.getByTestId(todayTestIDs.gettingStarted)).toBeTruthy();
    expect(
      screen.queryByTestId(todayTestIDs.statCard('expired')),
    ).not.toBeOnTheScreen();
    fireEvent.press(screen.getByTestId(todayTestIDs.gettingStartedStart));

    expect(startGuide).toHaveBeenCalledWith(GUIDE_TOURS.shop);
    expect(mockNav.toShoppingListMain).toHaveBeenCalledTimes(1);
  });
});

describe("today's meals", () => {
  it("lists today's meals alone, and opens one's recipe", async () => {
    await openToday();
    await everything();

    expect(screen.getByTestId(todayTestIDs.mealRow('mi1'))).toBeTruthy();
    expect(
      screen.queryByTestId(todayTestIDs.mealRow('mi2')),
    ).not.toBeOnTheScreen();
    fireEvent.press(
      within(screen.getByTestId(todayTestIDs.mealRow('mi1'))).getByText(
        'Shakshuka',
      ),
    );

    expect(mockNav.toRecipeDetail).toHaveBeenCalledWith({ recipeId: 'r1' });
  });

  it('holds a meal row’s place until the plans answer, never "nothing planned"', async () => {
    await openToday({
      answers: [
        currentPlan({ held: true }),
        counts(),
        plans(true, true),
        suggestions(),
        lists(),
      ],
    });
    await landed(TodayCountsDocument);

    expect(screen.UNSAFE_getByType(MealPlanItemCardSkeleton)).toBeTruthy();
    expect(
      screen.queryByTestId(todayTestIDs.nothingPlanned),
    ).not.toBeOnTheScreen();
  });

  it('says the meals cannot be read offline, never "nothing planned"', async () => {
    useStore.setState({ apiReachable: false });
    await openToday({
      answers: [
        currentPlan({ fails: true }),
        counts(),
        plans(),
        plan(true),
        suggestions(),
        lists(),
      ],
    });
    await landed(
      TodayCountsDocument,
      GetMealPlansDocument,
      GetMealPlanDocument,
    );

    expect(screen.getByTestId(kitTestIDs.stateOffline)).toBeTruthy();
    expect(
      screen.queryByTestId(todayTestIDs.nothingPlanned),
    ).not.toBeOnTheScreen();
  });

  it('says nothing is planned, and opens Meal Plan from there', async () => {
    await openToday({
      answers: [
        currentPlan({ none: true }),
        counts(),
        plans(false),
        suggestions(),
        lists(),
      ],
    });
    await landed(TodayCountsDocument, CurrentMealPlanDocument);
    await landed(GetMealPlansDocument);

    fireEvent.press(screen.getByTestId(todayTestIDs.nothingPlanned));

    expect(mockNav.toMealPlanMain).toHaveBeenCalled();
  });
});

describe('based on your pantry', () => {
  it('previews the first three, opening one, and Recipes from "See all"', async () => {
    await openToday();
    await everything();

    expect(screen.getByText(t('recipes.basedOnPantry'))).toBeTruthy();
    expect(screen.getByText('Recipe 3')).toBeTruthy();
    expect(screen.queryByText('Recipe 4')).not.toBeOnTheScreen();
    fireEvent.press(screen.getByText('Recipe 1'));
    fireEvent.press(screen.getByTestId(todayTestIDs.suggestionsSeeAll));

    expect(mockNav.toRecipeDetail).toHaveBeenCalledWith(
      expect.objectContaining({ recipeId: 's1' }),
    );
    expect(mockNav.toRecipeMain).toHaveBeenCalled();
  });

  it('is not shown with nothing to suggest', async () => {
    await openToday({
      answers: [
        currentPlan(),
        counts(),
        plans(),
        plan(),
        suggestions(0),
        lists(),
      ],
    });
    await everything();

    expect(
      screen.queryByText(t('recipes.basedOnPantry')),
    ).not.toBeOnTheScreen();
  });

  it('holds the rows’ place while they load', async () => {
    await openToday({
      answers: [
        currentPlan(),
        counts(),
        plans(),
        plan(),
        suggestions(5, 80, true),
        lists(),
      ],
    });
    await landed(TodayCountsDocument);

    expect(screen.getByText(t('recipes.basedOnPantry'))).toBeTruthy();
    expect(screen.UNSAFE_getAllByType(ItemCardSkeleton)).toHaveLength(3);
  });

  it('calls them recipes to try when they use nothing the pantry holds', async () => {
    await openToday({
      answers: [
        currentPlan(),
        counts(),
        plans(),
        plan(),
        suggestions(5, 0),
        lists(),
      ],
    });
    await everything();

    expect(screen.getByText(t('labels.recipesToTry'))).toBeTruthy();
    expect(
      screen.queryByText(t('recipes.basedOnPantry')),
    ).not.toBeOnTheScreen();
  });
});

describe('pull to refresh', () => {
  it('asks every section again', async () => {
    await openToday();
    await everything();

    act(() => {
      screen.UNSAFE_getByType(Screen).props.refresh.onRefresh();
    });
    await log.requested(TodayCountsDocument, 2);
    await log.requested(GetShoppingListsLiteDocument, 2);
    await log.requested(RecipeSuggestionsDocument, 2);
  });
});

describe('shopping', () => {
  it('shows the items left and opens the List tab on that list', async () => {
    await openToday();
    await everything();

    fireEvent.press(screen.getByTestId(todayTestIDs.shoppingRow));

    expect(screen.getByText('Weekly')).toBeTruthy();
    expect(screen.getByText(t('today.itemsLeft', { count: 5 }))).toBeTruthy();
    expect(useStore.getState().selectedShoppingListId).toBe('l1');
    expect(mockNav.toShoppingListMain).toHaveBeenCalled();
  });

  it('is not shown with no list', async () => {
    await openToday({
      answers: [
        currentPlan(),
        counts(),
        plans(),
        plan(),
        suggestions(),
        lists(false),
      ],
    });
    await everything();

    expect(
      screen.queryByTestId(todayTestIDs.shoppingRow),
    ).not.toBeOnTheScreen();
  });
});

describe('first run', () => {
  it('explains how to start for an empty pantry with no plan or list', async () => {
    await openToday({
      answers: [
        currentPlan({ none: true }),
        counts(0, 0, 0),
        plans(false),
        suggestions(0),
        lists(false),
      ],
    });
    await landed(TodayCountsDocument, CurrentMealPlanDocument);
    await landed(GetMealPlansDocument, GetShoppingListsLiteDocument);

    expect(screen.getByTestId(todayTestIDs.firstRun)).toBeTruthy();
    expect(screen.getByText(t('today.firstRunTitle'))).toBeTruthy();
    expect(
      screen.queryByTestId(todayTestIDs.statCard('expired')),
    ).not.toBeOnTheScreen();
  });

  it('starts by setting up a household when there is none', async () => {
    await openToday({ held: [], selectedHomeId: null });

    fireEvent.press(screen.getByText(t('labels.getStarted')));

    expect(screen.getByText(t('pantryScreen.noHomeTitle'))).toBeTruthy();
    expect(mockNav.toHomeManagement).toHaveBeenCalled();
  });
});

describe("Today's +", () => {
  it("offers every tab's add, each handing it to its tab", async () => {
    const actions = watchAddMenu();
    await openToday();

    expect(actions().map(action => action.label)).toEqual([
      t('labels.addPantryItem'),
      t('labels.addToShoppingList'),
      t('labels.addMeal'),
      t('labels.addRecipe'),
    ]);
    // What the store is handed: Today then leaves, and the tab it opens runs it.
    const handOver = (key: string) => {
      const action = actions().find(each => each.key === key);
      if (!action) throw new Error(`no ${key} action`);
      const handed: PendingTabAdd[] = [];
      const stop = useStore.subscribe(({ pendingTabAdd }) => {
        if (pendingTabAdd) handed.push(pendingTabAdd);
      });
      act(() => {
        action.onPress();
      });
      stop();
      return handed[0];
    };
    expect(handOver('pantry')).toEqual({ tab: 'Pantry', actionKey: 'search' });
    expect(mockNav.toPantryMain).toHaveBeenCalled();
    expect(handOver('list')).toEqual({
      tab: 'ShoppingList',
      actionKey: 'search',
    });
    expect(mockNav.toShoppingListMain).toHaveBeenCalled();
    expect(handOver('meal')).toEqual({ tab: 'MealPlan', actionKey: 'meal' });
    expect(mockNav.toMealPlanMain).toHaveBeenCalled();
    expect(handOver('recipe')).toEqual({ tab: 'Recipe' });
    expect(mockNav.toRecipeMain).toHaveBeenCalled();
  });
});

describe('tutorial', () => {
  it('points the household step at the title, for a user in two homes, once the overview is ready', async () => {
    const options = watchTutorial();
    await openToday({ held: [KITCHEN_HOME, CABIN] });
    await everything();
    fireEvent(screen.getByText('Test Home'), 'layout', {
      nativeEvent: { layout: TITLE_RECT },
    });

    expect(
      options()?.steps.map(step => [step.featureId, step.rectKey]),
    ).toEqual([['pantry_tutorial_home', 'household']]);
    expect(options()?.steps[0]?.when?.()).toBe(true);
    expect(options()?.targetRects.household).toEqual(TITLE_RECT);
    expect(options()?.canStart).toBe(true);
  });

  it('waits while a menu covers Today', async () => {
    const options = watchTutorial();
    await openToday({ held: [KITCHEN_HOME, CABIN] });
    await everything();
    expect(options()?.isPaused).toBe(false);

    act(() => coverToday(true));

    expect(options()?.isPaused).toBe(true);
  });

  it('shows no homes tip to a user with one home', async () => {
    const options = watchTutorial();
    await openToday();
    await everything();

    expect(options()?.steps[0]?.when?.()).toBe(false);
  });

  it('waits for the overview before starting', async () => {
    const options = watchTutorial();
    await openToday({
      answers: [
        currentPlan(),
        counts(9, 6, 3, true),
        plans(),
        plan(),
        suggestions(),
        lists(),
      ],
    });

    expect(options()?.canStart).toBe(false);
  });
});

describe('the launch metric', () => {
  it('marks Today drawn once its counts show, not while they load', async () => {
    const markFullyDrawn = jest.spyOn(
      NativePerformanceService,
      'markFullyDrawn',
    );
    const answer = counts(9, 6, 3, true);
    await openToday({
      answers: [currentPlan(), answer, plans(), plan(), suggestions(), lists()],
    });
    expect(markFullyDrawn).not.toHaveBeenCalled();

    answer.release();
    await landed(TodayCountsDocument);

    expect(markFullyDrawn).toHaveBeenCalledTimes(1);
  });

  it('marks a first run drawn too', async () => {
    const markFullyDrawn = jest.spyOn(
      NativePerformanceService,
      'markFullyDrawn',
    );
    await openToday({ held: [], selectedHomeId: null });

    expect(markFullyDrawn).toHaveBeenCalledTimes(1);
  });
});
