import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { useStore } from '#store';
import { CachedImage } from '#components/atoms/CachedImage';
import { kitTestIDs } from '#components/testIDs';
import type { TabBarAddAction } from '#/context/TabBarActionsContext';
import { useTabBarAddMenu } from '#hooks/navigation/useTabBarAddMenu';
import { useTutorialSequence } from '#hooks/ui/useTutorialSequence';
import { todayTestIDs } from '#features/today/testIDs';
import { useTodayOverview } from '../useTodayOverview';
import { TodayMain } from '../TodayMain';

const mockNavigation = {
  toHomeManagement: jest.fn(),
  toNotifications: jest.fn(),
  toProfile: jest.fn(),
  toFilteredPantryItems: jest.fn(),
  toRecipeDetail: jest.fn(),
  toPantryMain: jest.fn(),
  toShoppingListMain: jest.fn(),
  toRecipeMain: jest.fn(),
  toMealPlanMain: jest.fn(),
};
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => mockNavigation,
}));
jest.mock('#hooks/navigation/useTabBarAddMenu', () => ({
  useTabBarAddMenu: jest.fn(),
}));
jest.mock('../useTodayOverview', () => ({
  ...jest.requireActual<typeof import('../useTodayOverview')>(
    '../useTodayOverview',
  ),
  useTodayOverview: jest.fn(),
}));
jest.mock('#/context/TabBarActionsContext', () => ({
  useTabBarState: () => ({ isOverlayOpen: false }),
}));
jest.mock('#hooks/ui/useTutorialSequence', () => ({
  useTutorialSequence: jest.fn(() => ({
    currentStep: null,
    advance: jest.fn(),
    advanceInPlace: jest.fn(),
    skipAll: jest.fn(),
  })),
}));
const TITLE_RECT = { x: 16, y: 60, width: 140, height: 28 };
// The test renderer has no layout to measure; this reports a fixed rect so the
// wiring is what is under test.
jest.mock('#hooks/ui/useMeasuredRect', () => ({
  useMeasuredRect: (onMeasure?: (rect: typeof TITLE_RECT) => void) => ({
    ref: { current: null },
    measure: () => onMeasure?.({ x: 16, y: 60, width: 140, height: 28 }),
  }),
}));
// The planned-meal row is the meal plan's own card; its read-only rendering is
// tested beside it. Here only what Today hands it matters.
jest.mock('#features/mealPlan/ui/MealPlanItemCard', () => {
  const { Pressable: MockPressable, Text: MockText } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MealPlanItemCard: ({
      mealTypeLabel,
      onPress,
    }: {
      mealTypeLabel: string;
      onPress?: () => void;
    }) => (
      <MockPressable onPress={onPress} disabled={!onPress}>
        <MockText>{mealTypeLabel}</MockText>
      </MockPressable>
    ),
  };
});

jest.mock('#components/molecules/ItemCardSkeleton', () => {
  const { View: MockView } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return { ItemCardSkeleton: () => <MockView testID="suggestion-skeleton" /> };
});
jest.mock('#features/mealPlan/ui/MealPlanItemCardSkeleton', () => {
  const { View: MockView } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MealPlanItemCardSkeleton: () => <MockView testID="meal-skeleton" />,
  };
});

type Overview = ReturnType<typeof useTodayOverview>;

const overviewOf = (overrides: Partial<Overview> = {}): Overview => ({
  householdName: 'Test Home',
  selectedHomeId: 'h1',
  unreadCount: 0,
  state: 'ready',
  needsHousehold: false,
  retry: jest.fn(),
  counts: { expired: 6, expiring: 3, lowStock: 0 },
  meals: [],
  mealsLoading: false,
  suggestions: { items: [], loading: false, fromPantry: true },
  refreshing: false,
  refresh: jest.fn(),
  shopping: null,
  ...overrides,
});

const mockedOverview = jest.mocked(useTodayOverview);
const mockedAddMenu = jest.mocked(useTabBarAddMenu);
const mockedTutorial = jest.mocked(useTutorialSequence);

function renderToday(overrides: Partial<Overview> = {}) {
  mockedOverview.mockReturnValue(overviewOf(overrides));
  return render(<TodayMain />);
}

const addAction = (key: string): TabBarAddAction => {
  const [actions] = mockedAddMenu.mock.lastCall ?? [];
  const action = actions?.find(candidate => candidate.key === key);
  if (!action) throw new Error(`no ${key} action`);
  return action;
};

beforeEach(() => {
  jest.clearAllMocks();
  act(() => {
    useStore.setState({
      pendingTabAdd: null,
      selectedShoppingListId: null,
      user: null,
    });
  });
});

describe('header', () => {
  it('names the household and opens Home Management on it', () => {
    renderToday();

    fireEvent.press(screen.getByTestId(todayTestIDs.householdTitle));

    expect(screen.getByText('Test Home')).toBeTruthy();
    expect(mockNavigation.toHomeManagement).toHaveBeenCalledWith({
      selectedHomeId: 'h1',
    });
  });

  it('offers notifications and Profile', () => {
    renderToday();

    fireEvent.press(screen.getByTestId(todayTestIDs.notificationsButton));
    fireEvent.press(screen.getByTestId(kitTestIDs.tab('Profile')));

    expect(mockNavigation.toNotifications).toHaveBeenCalled();
    expect(mockNavigation.toProfile).toHaveBeenCalled();
  });

  it("shows the user's photo for Profile, and the glyph without one", () => {
    const profilePhoto = () =>
      within(screen.getByTestId(kitTestIDs.tab('Profile'))).UNSAFE_queryByType(
        CachedImage,
      )?.props.uri;
    act(() => {
      useStore.setState({
        user: {
          id: 'u1',
          email: 'test@souschef.dev',
          emailVerified: true,
          onBoarded: true,
          profilePicture: 'https://example.com/me.jpg',
        },
      });
    });
    const { rerender } = renderToday();
    expect(profilePhoto()).toBe('https://example.com/me.jpg');

    act(() => {
      useStore.setState({ user: null });
    });
    rerender(<TodayMain />);
    expect(profilePhoto()).toBeUndefined();
  });

  it('marks unread notifications on the bell', () => {
    renderToday({ unreadCount: 3 });

    expect(
      within(screen.getByTestId(todayTestIDs.notificationsButton)).getByText(
        '3',
      ),
    ).toBeTruthy();
  });
});

describe('status counts', () => {
  it('shows the three counts in order, a muted zero included', () => {
    renderToday();

    const values = [
      todayTestIDs.statCard('expired'),
      todayTestIDs.statCard('expiring'),
      todayTestIDs.statCard('lowStock'),
    ].map(id => within(screen.getByTestId(id)).getAllByText(/^\d+$/)[0]);
    expect(values.map(node => node?.props.children)).toEqual(['6', '3', '0']);
  });

  it('opens the expired items from their card', () => {
    renderToday();

    fireEvent.press(screen.getByTestId(todayTestIDs.statCard('expired')));

    expect(mockNavigation.toFilteredPantryItems).toHaveBeenCalledWith({
      mode: 'expired',
    });
  });

  it('opens nothing from a card at zero', () => {
    renderToday();

    fireEvent.press(screen.getByTestId(todayTestIDs.statCard('lowStock')));

    expect(mockNavigation.toFilteredPantryItems).not.toHaveBeenCalled();
  });
});

describe("today's meals", () => {
  const meal = {
    id: 'mi1',
    item: {
      __typename: 'MealPlanItem',
      id: 'mi1',
    } as Overview['meals'][number]['item'],
    mealTypeLabel: 'Dinner',
    recipeId: 'r1',
  };

  it("opens a planned meal's recipe", () => {
    renderToday({ meals: [meal] });

    fireEvent.press(screen.getByText('Dinner'));

    expect(mockNavigation.toRecipeDetail).toHaveBeenCalledWith({
      recipeId: 'r1',
    });
  });

  it('holds a meal row’s place until the plans answer, never "nothing planned"', () => {
    renderToday({ meals: [], mealsLoading: true });

    expect(screen.getByTestId('meal-skeleton')).toBeTruthy();
    expect(screen.queryByText('Nothing planned for today')).toBeNull();
  });

  it('says nothing is planned, and opens Meal Plan from there', () => {
    renderToday({ meals: [] });

    fireEvent.press(screen.getByTestId(todayTestIDs.nothingPlanned));

    expect(screen.getByText('Nothing planned for today')).toBeTruthy();
    expect(mockNavigation.toMealPlanMain).toHaveBeenCalled();
  });
});

describe('based on your pantry', () => {
  const suggestion = (id: string) => ({
    id: `recipe-${id}`,
    title: `Recipe ${id}`,
    subtitle: '2 servings',
    target: { recipeId: id },
  });

  const suggestions = (
    over: Partial<Overview['suggestions']> = {},
  ): Overview['suggestions'] => ({
    items: [],
    loading: false,
    fromPantry: true,
    ...over,
  });

  it('opens a suggestion, and Recipes from "See all"', () => {
    renderToday({
      suggestions: suggestions({ items: [suggestion('s1'), suggestion('s2')] }),
    });

    fireEvent.press(screen.getByText('Recipe s1'));
    fireEvent.press(screen.getByTestId(todayTestIDs.suggestionsSeeAll));

    expect(screen.getByText('Based on your pantry')).toBeTruthy();
    expect(mockNavigation.toRecipeDetail).toHaveBeenCalledWith({
      recipeId: 's1',
    });
    expect(mockNavigation.toRecipeMain).toHaveBeenCalled();
  });

  it('is not shown with nothing to suggest', () => {
    renderToday({ suggestions: suggestions() });

    expect(screen.queryByText('Based on your pantry')).toBeNull();
  });

  it('holds the rows’ place while the suggestions load', () => {
    renderToday({ suggestions: suggestions({ loading: true }) });

    expect(screen.getByText('Based on your pantry')).toBeTruthy();
    expect(screen.getAllByTestId('suggestion-skeleton')).toHaveLength(3);
  });

  // An empty pantry is ranked too, using none of it.
  it('calls them recipes to try when they use nothing the pantry holds', () => {
    renderToday({
      suggestions: suggestions({
        items: [suggestion('s1')],
        fromPantry: false,
      }),
    });

    expect(screen.getByText('Recipes to try')).toBeTruthy();
    expect(screen.queryByText('Based on your pantry')).toBeNull();
  });
});

describe('pull to refresh', () => {
  it('refreshes the overview from the scroll host', () => {
    const refresh = jest.fn();
    renderToday({ refresh });

    act(() => {
      screen
        .getByTestId(todayTestIDs.scroll)
        .props.refreshControl.props.onRefresh();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe('shopping', () => {
  it('shows the items left and opens the List tab on that list', () => {
    renderToday({ shopping: { id: 'l1', name: 'Weekly', itemsLeft: 5 } });

    fireEvent.press(screen.getByTestId(todayTestIDs.shoppingRow));

    expect(screen.getByText('Weekly')).toBeTruthy();
    expect(screen.getByText('5 items left to buy')).toBeTruthy();
    expect(useStore.getState().selectedShoppingListId).toBe('l1');
    expect(mockNavigation.toShoppingListMain).toHaveBeenCalled();
  });

  it('is not shown with no list', () => {
    renderToday({ shopping: null });

    expect(screen.queryByTestId(todayTestIDs.shoppingRow)).toBeNull();
  });
});

describe('first run', () => {
  it('explains how to start instead of showing empty sections', () => {
    renderToday({ state: 'empty', counts: null });

    expect(screen.getByTestId(todayTestIDs.firstRun)).toBeTruthy();
    expect(screen.getByText('Start with your pantry')).toBeTruthy();
    expect(screen.queryByTestId(todayTestIDs.statCard('expired'))).toBeNull();
    expect(screen.queryByTestId(todayTestIDs.nothingPlanned)).toBeNull();
  });

  it('starts by setting up a household when there is none', () => {
    renderToday({ state: 'empty', counts: null, needsHousehold: true });

    fireEvent.press(screen.getByText('Get Started'));

    expect(mockNavigation.toHomeManagement).toHaveBeenCalled();
  });
});

describe("Today's +", () => {
  it("offers every tab's add", () => {
    renderToday();

    const [actions] = mockedAddMenu.mock.lastCall ?? [];
    expect(actions?.map(action => action.label)).toEqual([
      'Add pantry item',
      'Add to shopping list',
      'Add meal',
      'Add recipe',
    ]);
  });

  it.each([
    ['pantry', { tab: 'Pantry', actionKey: 'search' }, 'toPantryMain'],
    [
      'list',
      { tab: 'ShoppingList', actionKey: 'search' },
      'toShoppingListMain',
    ],
    ['meal', { tab: 'MealPlan', actionKey: 'meal' }, 'toMealPlanMain'],
    ['recipe', { tab: 'Recipe' }, 'toRecipeMain'],
  ] as const)(
    '%s leaves the add for its tab and goes there',
    (key, pending, destination) => {
      renderToday();

      act(() => addAction(key).onPress());

      expect(useStore.getState().pendingTabAdd).toEqual(pending);
      expect(mockNavigation[destination]).toHaveBeenCalled();
    },
  );
});

describe('tutorial', () => {
  it("points Pantry's household step, under its old id, at the title", () => {
    renderToday();

    // The measured view is the title row inside the pressable title.
    const [titleRow] = screen.getByTestId(todayTestIDs.householdTitle).children;
    if (!titleRow || typeof titleRow === 'string') throw new Error('no title');
    fireEvent(titleRow, 'layout');

    const [options] = mockedTutorial.mock.lastCall ?? [];
    expect(options?.steps.map(step => [step.featureId, step.rectKey])).toEqual([
      ['pantry_tutorial_home', 'household'],
    ]);
    expect(options?.targetRects.household).toEqual(TITLE_RECT);
    expect(options?.canStart).toBe(true);
  });

  it('waits for the overview before starting', () => {
    renderToday({ state: 'loading', counts: null });

    const [options] = mockedTutorial.mock.lastCall ?? [];
    expect(options?.canStart).toBe(false);
  });
});
