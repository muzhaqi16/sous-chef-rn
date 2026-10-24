'use no memo';

import React from 'react';
import { render, userEvent, act, within } from '@testing-library/react-native';
import { RecipeMain } from '../RecipeMain';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { useTabBarAddMenu } from '#hooks/navigation/useTabBarAddMenu';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import type { BarAction } from '#components/molecules/BarActions';
import {
  Diet,
  ExternalSource,
  Intolerance,
} from '#/graphql/generated/schemaTypes';
import type { DisplayItem } from '../recipeDisplayItems';

type RecipeMainItem = DisplayItem;

interface ItemListMockProps {
  items?: RecipeMainItem[];
  onItemPress?: (id: string | number) => void;
  onRefresh?: () => Promise<void>;
  ListHeaderComponent?: React.ReactElement | null;
  emptyState?: { title: string; description?: string };
}

interface DeferredScreenMockProps {
  fallback: React.ReactNode;
  component: React.ComponentType;
}

interface TabScreenHeaderMockProps {
  title?: string;
  actions?: BarAction[];
}

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  })),
  useFocusEffect: jest.fn(),
}));

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(() => false),
}));
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: jest.fn(() => false),
}));
// Each has its own suite; here only whether the screen renders them.
jest.mock('#features/recipes/components/capture/CaptureSheet', () => ({
  CaptureSheet: () => null,
}));
jest.mock('#features/recipes/components/capture/PhotoCaptureSheet', () => ({
  PhotoCaptureSheet: () => null,
}));
// The capture host starts captures for its sheets, which render outside the navigator.
jest.mock('#features/recipes/hooks/useRecipeCapture', () => ({
  useRecipeCapture: () => ({ start: jest.fn(), sending: false }),
}));
jest.mock('#features/recipes/components/capture/CapturePollers', () => ({
  CapturePollers: () => null,
}));
jest.mock('#features/recipes/components/capture/CaptureRows', () => ({
  CaptureRows: () => null,
}));
jest.mock('#hooks/navigation/useTabBarAddMenu', () => ({
  useTabBarAddMenu: jest.fn(),
}));
jest.mock('#/context/TabBarActionsContext', () => ({
  useTabBarSetters: jest.fn(() => ({
    scrollTabBarHidden: { value: false, set: jest.fn() },
    setScannerProps: jest.fn(),
    setActiveTab: jest.fn(),
    setOverlayOpen: jest.fn(),
    setAddButtonRect: jest.fn(),
  })),
}));
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#hooks/performance/useTabScreenLifecycle', () => ({
  useTabScreenLifecycle: jest.fn(),
}));
jest.mock('#hooks/performance/useCommitTracking', () => ({
  useCommitTracking: jest.fn(),
}));

jest.mock('#features/recipes/screens/useRecipeScreen', () => ({
  useRecipeScreen: jest.fn(() => ({
    discovery: { mode: 'none', items: [], loading: false, refresh: jest.fn() },
    pantryItems: [],
    hasPantryItems: false,
    items: [],
    searchQuery: '',
    searchResults: [],
    searchPerformed: false,
    searchLoading: false,
    selectedIngredients: new Set(),
    showSearchResults: false,
    showDiscovery: false,
    emptyStateConfig: {
      icon: 'restaurant-outline',
      title: 'Discover Recipes',
      description: 'Search',
    },
    activeFilters: {
      diet: [],
      intolerances: [],
      mealType: null,
      maxReadyTime: null,
    },
    applyFilters: jest.fn(),
    activeFilterCount: 0,
    removeFilter: jest.fn(),
    clearFiltersAndSearchAgain: jest.fn(),
    handleTextSearch: jest.fn(),
    handleIngredientSearch: jest.fn(),
    handleRefresh: jest.fn(),
    clearSearch: jest.fn(),
    toggleIngredient: jest.fn(),
  })),
}));

jest.mock(
  '#components/organisms/SpotlightCoachMark/SpotlightCoachMark',
  () => ({ SpotlightCoachMark: () => null }),
);
jest.mock('#hooks/ui/useTutorialSequence', () => ({
  useTutorialSequence: jest.fn(() => ({
    currentStep: null,
    dismiss: jest.fn(),
    isActive: false,
  })),
}));
jest.mock('#hooks/settings/useFeatureHint', () => ({}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: () => null,
  useBottomSheetScrollableCreator: jest.fn(
    () => require('react-native').ScrollView,
  ),
  useBottomSheetSpringConfigs: jest.fn(() => ({})),
}));
jest.mock(
  '#features/recipes/components/recipeSearch/IngredientSelectorSheet',
  () => {
    const R = require('react');
    return {
      IngredientSelectorSheet: R.forwardRef(() => null),
    };
  },
);

let mockItemListImpl: (
  props: ItemListMockProps,
) => React.ReactElement | null = () => null;

jest.mock('#components/organisms/ItemList', () => ({
  ItemList: (props: ItemListMockProps) => mockItemListImpl(props),
}));

const mockDeferredScreen = jest.fn(
  ({ fallback }: DeferredScreenMockProps) => fallback,
);
jest.mock('#components/performance/DeferredScreen', () => ({
  DeferredScreen: (props: DeferredScreenMockProps) => mockDeferredScreen(props),
}));
jest.mock('#features/recipes/components/skeletons/RecipeSkeleton', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return {
    RecipeSkeleton: () => R.createElement(Text, null, 'RecipeSkeleton'),
  };
});
jest.mock('#components/molecules/TabScreenHeader', () => ({
  TabScreenHeader: ({ title, actions }: TabScreenHeaderMockProps) => {
    const R = require('react');
    const { View, Text } = require('react-native');
    const { BarActions } = require('#components/molecules/BarActions');
    return R.createElement(
      View,
      null,
      R.createElement(Text, null, title),
      R.createElement(BarActions, { actions, placement: 'gutter' }),
    );
  },
}));
// Renders the field's one accessory (the diet filter), so its label and count
// can be read; the field itself is not under test here.
jest.mock('#components/molecules/SearchBar', () => ({
  SearchBar: ({
    accessory,
  }: {
    accessory?: {
      accessibilityLabel: string;
      onPress: () => void;
      badge?: number;
    };
  }) => {
    const R = require('react');
    const { Pressable, Text } = require('react-native');
    if (!accessory) return 'SearchBar';
    return R.createElement(
      Pressable,
      {
        accessibilityLabel: accessory.accessibilityLabel,
        onPress: accessory.onPress,
      },
      accessory.badge
        ? R.createElement(Text, null, String(accessory.badge))
        : null,
    );
  },
}));
jest.mock('#/styles/commonStyles', () => ({ commonStyles: {} }));
jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: 'CachedImage',
}));
jest.mock('#components/templates/Sheet', () => ({
  Sheet: () => null,
}));
jest.mock('../../context/IngredientSelectionContext', () => ({
  IngredientSelectionProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useIngredientSelection: jest.fn(() => ({
    selectedIngredients: new Set(),
    toggleIngredient: jest.fn(),
  })),
}));

// Helper to create a useRecipeScreen mock with overrides
function mockScreenWith(overrides: Record<string, unknown>) {
  const { useRecipeScreen } = jest.requireMock(
    '#features/recipes/screens/useRecipeScreen',
  );
  useRecipeScreen.mockReturnValue({
    discovery: { mode: 'none', items: [], loading: false, refresh: jest.fn() },
    pantryItems: [],
    hasPantryItems: false,
    items: [],
    searchQuery: '',
    searchResults: [],
    searchPerformed: false,
    searchLoading: false,
    selectedIngredients: new Set(),
    showSearchResults: false,
    showDiscovery: false,
    emptyStateConfig: {
      icon: 'restaurant-outline',
      title: 'Discover Recipes',
      description: 'Search',
    },
    activeFilters: {
      diet: [],
      intolerances: [],
      mealType: null,
      maxReadyTime: null,
    },
    applyFilters: jest.fn(),
    activeFilterCount: 0,
    removeFilter: jest.fn(),
    clearFiltersAndSearchAgain: jest.fn(),
    handleTextSearch: jest.fn(),
    handleIngredientSearch: jest.fn(),
    handleRefresh: jest.fn(),
    clearSearch: jest.fn(),
    toggleIngredient: jest.fn(),
    ...overrides,
  });
}

describe('RecipeMain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockItemListImpl = (props: ItemListMockProps) =>
      props.ListHeaderComponent ?? null;
    mockScreenWith({});
  });

  it('renders the outer component with fallback', () => {
    const { getByTestId } = render(<RecipeMain />);
    expect(getByTestId('recipes-screen')).toBeTruthy();
  });

  it('renders inner component when DeferredScreen renders component', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    const { getByTestId } = render(<RecipeMain />);
    expect(getByTestId('recipes-screen')).toBeTruthy();
  });

  it('shows saved and my recipes in the header, and the diet filter beside search', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    const tree = render(<RecipeMain />);
    expect(tree.getByLabelText('Saved recipes')).toBeTruthy();
    expect(tree.getByLabelText('My recipes')).toBeTruthy();
    expect(tree.getByLabelText('Dietary restrictions')).toBeTruthy();
  });

  describe('search modes', () => {
    beforeEach(() => {
      mockDeferredScreen.mockImplementation(
        ({ component: Component }: { component: React.ComponentType }) => (
          <Component />
        ),
      );
    });

    it('offers name and ingredient search when the pantry has items', () => {
      mockScreenWith({ hasPantryItems: true });
      const tree = render(<RecipeMain />);
      expect(tree.getByText('By name')).toBeTruthy();
      expect(tree.getByText('By ingredients')).toBeTruthy();
    });

    it('searches by name only with an empty pantry', () => {
      mockScreenWith({ hasPantryItems: false });
      const tree = render(<RecipeMain />);
      expect(tree.queryByText('By ingredients')).toBeNull();
      expect(tree.getByLabelText('Dietary restrictions')).toBeTruthy();
    });

    it('swaps the filter for the pantry picker in ingredient mode', async () => {
      const user = userEvent.setup();
      mockScreenWith({ hasPantryItems: true });
      const tree = render(<RecipeMain />);

      await user.press(tree.getByText('By ingredients'));

      expect(tree.getByTestId(recipesTestIDs.ingredientPicker)).toBeTruthy();
      expect(tree.queryByLabelText('Dietary restrictions')).toBeNull();
    });

    // An empty ingredient search otherwise stays on screen in name mode.
    it("drops the other mode's search when switching", async () => {
      const user = userEvent.setup();
      const clearSearch = jest.fn();
      mockScreenWith({ hasPantryItems: true, clearSearch });
      const tree = render(<RecipeMain />);

      await user.press(tree.getByText('By ingredients'));
      expect(clearSearch).toHaveBeenCalledTimes(1);

      await user.press(tree.getByText('By name'));
      expect(clearSearch).toHaveBeenCalledTimes(2);
    });
  });

  it('navigates to SavedRecipes when bookmark icon pressed', async () => {
    const user = userEvent.setup();
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    const mockToSavedRecipes = jest.fn();
    const { useAppNavigation } = jest.requireMock(
      '#hooks/navigation/useAppNavigation',
    );
    useAppNavigation.mockReturnValue({
      toRecipeCreate: jest.fn(),
      toRecipeDetail: jest.fn(),
      toSavedRecipes: mockToSavedRecipes,
      toMyRecipes: jest.fn(),
      goBack: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    await user.press(tree.getByLabelText('Saved recipes'));
    expect(mockToSavedRecipes).toHaveBeenCalledTimes(1);
  });

  it('navigates to MyRecipes when create icon pressed', async () => {
    const user = userEvent.setup();
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    const mockToMyRecipes = jest.fn();
    const { useAppNavigation } = jest.requireMock(
      '#hooks/navigation/useAppNavigation',
    );
    useAppNavigation.mockReturnValue({
      toRecipeCreate: jest.fn(),
      toRecipeDetail: jest.fn(),
      toSavedRecipes: jest.fn(),
      toMyRecipes: mockToMyRecipes,
      goBack: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    await user.press(tree.getByLabelText('My recipes'));
    expect(mockToMyRecipes).toHaveBeenCalledTimes(1);
  });

  it('shows discovery items from useRecipeScreen', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    mockScreenWith({
      showDiscovery: true,
      discovery: {
        mode: 'random',
        items: [{ id: '1', title: 'Soup', subtitle: '4 servings' }],
        loading: false,
        refresh: jest.fn(),
        pantryItems: [],
        hasPantryItems: false,
      },
      items: [
        {
          id: '1',
          title: 'Soup',
          subtitle: '4 servings',
          badge: { text: 'Suggested' },
        },
      ],
    });

    let capturedItems: RecipeMainItem[] | undefined;
    mockItemListImpl = (props: ItemListMockProps) => {
      capturedItems = props.items;
      return null;
    };

    render(<RecipeMain />);
    expect(capturedItems!.length).toBe(1);
    expect(capturedItems![0]!.title).toBe('Soup');
  });

  it('keeps shown discovery rows on screen while discovery loads again', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    mockScreenWith({
      showDiscovery: true,
      discovery: {
        mode: 'pantry',
        loading: true,
        refresh: jest.fn(),
        pantryItems: [],
        hasPantryItems: true,
      },
      items: [{ id: '1', title: 'Soup', subtitle: '4 servings' }],
    });
    let capturedItems: RecipeMainItem[] | undefined;
    mockItemListImpl = (props: ItemListMockProps) => {
      capturedItems = props.items;
      return null;
    };

    const screen = render(<RecipeMain />);

    expect(screen.queryByText('RecipeSkeleton')).toBeNull();
    expect(capturedItems?.map(item => item.title)).toEqual(['Soup']);
  });

  it('shows pantry discovery header', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    mockScreenWith({
      showDiscovery: true,
      discovery: {
        mode: 'pantry',
        items: [{ id: '1', title: 'P', subtitle: 's' }],
        loading: false,
        refresh: jest.fn(),
        pantryItems: [],
        hasPantryItems: false,
      },
      items: [{ id: '1', title: 'P', subtitle: 's' }],
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByText('Based on your pantry')).toBeTruthy();
  });

  it('disables the refresh control while a refresh is in flight', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    mockScreenWith({
      showDiscovery: true,
      discovery: {
        mode: 'pantry',
        loading: false,
        refreshing: true,
        refresh: jest.fn(),
        pantryItems: [],
        hasPantryItems: true,
      },
      items: [{ id: '1', title: 'P', subtitle: 's' }],
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByLabelText('Refresh recipe suggestions')).toBeDisabled();
  });

  it('shows random discovery header', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    mockScreenWith({
      showDiscovery: true,
      discovery: {
        mode: 'random',
        items: [{ id: '1', title: 'R', subtitle: 's' }],
        loading: false,
        refresh: jest.fn(),
        pantryItems: [],
        hasPantryItems: false,
      },
      items: [{ id: '1', title: 'R', subtitle: 's' }],
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByText('Need inspiration?')).toBeTruthy();
  });

  it("opens a catalog recipe with the row's own title and image", () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    const mockToRecipeDetail = jest.fn();
    const { useAppNavigation } = jest.requireMock(
      '#hooks/navigation/useAppNavigation',
    );
    useAppNavigation.mockReturnValue({
      toRecipeCreate: jest.fn(),
      toRecipeDetail: mockToRecipeDetail,
      toSavedRecipes: jest.fn(),
      toMyRecipes: jest.fn(),
      goBack: jest.fn(),
    });
    mockScreenWith({
      showDiscovery: true,
      discovery: {
        mode: 'random',
        items: [{ id: '999', title: 'R', subtitle: 's' }],
        loading: false,
        refresh: jest.fn(),
        pantryItems: [],
        hasPantryItems: false,
      },
      items: [
        {
          id: 'catalog-SPOONACULAR-999',
          title: 'R',
          subtitle: 's',
          imageUrl: 'https://img.spoonacular.com/recipes/999-312x231.jpg',
          target: {
            catalog: {
              provider: ExternalSource.Spoonacular,
              externalId: '999',
              name: 'R',
              imageUrl: 'https://img.spoonacular.com/recipes/999-312x231.jpg',
            },
          },
        },
      ],
    });

    let capturedOnItemPress: ((id: string | number) => void) | undefined;
    mockItemListImpl = (props: ItemListMockProps) => {
      capturedOnItemPress = props.onItemPress;
      return null;
    };

    render(<RecipeMain />);
    act(() => {
      capturedOnItemPress!('catalog-SPOONACULAR-999');
    });
    // The row's own title and image show while the API opens the recipe.
    expect(mockToRecipeDetail).toHaveBeenCalledWith({
      catalog: {
        provider: ExternalSource.Spoonacular,
        externalId: '999',
        name: 'R',
        imageUrl: 'https://img.spoonacular.com/recipes/999-312x231.jpg',
      },
    });
  });

  it('opens a recipe the API holds by its id', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    const mockToRecipeDetail = jest.fn();
    const { useAppNavigation } = jest.requireMock(
      '#hooks/navigation/useAppNavigation',
    );
    useAppNavigation.mockReturnValue({
      toRecipeCreate: jest.fn(),
      toRecipeDetail: mockToRecipeDetail,
      toSavedRecipes: jest.fn(),
      toMyRecipes: jest.fn(),
      goBack: jest.fn(),
    });

    mockScreenWith({
      showSearchResults: true,
      items: [
        {
          id: 'recipe-abc123',
          title: 'Lasagna',
          subtitle: 's',
          target: { recipeId: 'abc123' },
        },
      ],
    });

    let capturedOnItemPress: ((id: string | number) => void) | undefined;
    mockItemListImpl = (props: ItemListMockProps) => {
      capturedOnItemPress = props.onItemPress;
      return null;
    };

    render(<RecipeMain />);
    act(() => {
      capturedOnItemPress!('recipe-abc123');
    });
    expect(mockToRecipeDetail).toHaveBeenCalledWith({ recipeId: 'abc123' });
  });

  it('shows the filter count badge when filters are active', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    mockScreenWith({
      activeFilterCount: 3,
      activeFilters: {
        diet: [Diet.Vegetarian],
        intolerances: [Intolerance.Dairy],
        mealType: null,
        maxReadyTime: 30,
      },
    });

    const tree = render(<RecipeMain />);
    const filterButton = tree.getByLabelText('Dietary restrictions');
    expect(within(filterButton).getByText('3')).toBeTruthy();
  });

  it('hides the filter count badge when no filters are active', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );

    const tree = render(<RecipeMain />);
    const filterButton = tree.getByLabelText('Dietary restrictions');
    expect(within(filterButton).queryByText(/\d/)).toBeNull();
  });

  it('shows a collapsed filter summary during text search that expands to removable chips', async () => {
    const user = userEvent.setup();
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    const mockRemoveFilter = jest.fn();
    const mockClearAndSearch = jest.fn();
    mockScreenWith({
      searchPerformed: true,
      searchQuery: 'pasta',
      activeFilterCount: 3,
      activeFilters: {
        diet: [Diet.Vegetarian],
        intolerances: [Intolerance.Dairy],
        mealType: null,
        maxReadyTime: 30,
      },
      removeFilter: mockRemoveFilter,
      clearFiltersAndSearchAgain: mockClearAndSearch,
    });

    const tree = render(<RecipeMain />);

    // Collapsed by default: summary visible, chips hidden
    expect(tree.getByText('3 filters active')).toBeTruthy();
    expect(tree.queryByText('Vegetarian')).toBeNull();

    await user.press(tree.getByTestId('active-filters-summary'));

    expect(tree.getByText('Vegetarian')).toBeTruthy();
    expect(tree.getByText('Dairy')).toBeTruthy();
    expect(tree.getByText('≤ 30 min')).toBeTruthy();

    await user.press(tree.getByText('Vegetarian'));
    expect(mockRemoveFilter).toHaveBeenCalledWith('diet', Diet.Vegetarian);

    await user.press(tree.getByText('≤ 30 min'));
    expect(mockRemoveFilter).toHaveBeenCalledWith('maxReadyTime', undefined);

    await user.press(tree.getByText('Clear'));
    expect(mockClearAndSearch).toHaveBeenCalledTimes(1);
  });

  it('hides the filter row on the discovery feed even with filters active', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    // Filters set, but no text search performed — discovery/ingredient
    // results don't take filters, so the row must not render.
    mockScreenWith({
      searchPerformed: false,
      searchQuery: '',
      activeFilterCount: 2,
      activeFilters: {
        diet: [Diet.Vegan],
        intolerances: [],
        mealType: null,
        maxReadyTime: 30,
      },
    });

    const tree = render(<RecipeMain />);
    expect(tree.queryByTestId('active-filters-summary')).toBeNull();
  });

  it('renders no filter row when no filters are active', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    mockScreenWith({ searchPerformed: true, searchQuery: 'pasta' });

    const tree = render(<RecipeMain />);
    expect(tree.queryByTestId('active-filters-summary')).toBeNull();
    expect(tree.queryByText('Clear')).toBeNull();
  });

  it('shows empty state from useRecipeScreen', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    let capturedEmptyState: ItemListMockProps['emptyState'];
    mockItemListImpl = (props: ItemListMockProps) => {
      capturedEmptyState = props.emptyState;
      return null;
    };

    render(<RecipeMain />);
    expect(capturedEmptyState!.title).toBe('Discover Recipes');
  });

  it('calls handleRefresh from useRecipeScreen on pull-to-refresh', async () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
    const mockRefresh = jest.fn();
    mockScreenWith({ handleRefresh: mockRefresh });

    let capturedOnRefresh: (() => Promise<void>) | undefined;
    mockItemListImpl = (props: ItemListMockProps) => {
      capturedOnRefresh = props.onRefresh;
      return null;
    };

    render(<RecipeMain />);
    await act(async () => {
      await capturedOnRefresh!();
    });
    expect(mockRefresh).toHaveBeenCalled();
  });
});

describe('RecipeMain: the ways to add a recipe', () => {
  const lastMenu = () =>
    jest.mocked(useTabBarAddMenu).mock.calls.at(-1)?.[0] ?? [];

  beforeEach(() => {
    jest.clearAllMocks();
    mockItemListImpl = (props: ItemListMockProps) =>
      props.ListHeaderComponent ?? null;
    mockScreenWith({});
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: { component: React.ComponentType }) => (
        <Component />
      ),
    );
  });

  it('writes a recipe at once while capture is switched off', () => {
    jest.mocked(useFeatureFlag).mockReturnValue(false);

    render(<RecipeMain />);

    expect(lastMenu().map(action => action.key)).toEqual(['manual']);
  });

  it('offers a link, photos and text before writing one, with capture on', () => {
    jest.mocked(useFeatureFlag).mockReturnValue(true);

    render(<RecipeMain />);

    expect(lastMenu().map(action => action.key)).toEqual([
      'link',
      'photo',
      'text',
      'manual',
    ]);
    expect(lastMenu().every(action => !action.disabledReason)).toBe(true);
  });

  it('offers only the sources switched on for this user', () => {
    jest
      .mocked(useFeatureFlag)
      .mockImplementation(flag => flag === 'recipeCaptureText');

    render(<RecipeMain />);

    expect(lastMenu().map(action => action.key)).toEqual(['text', 'manual']);
  });

  it('shows the capture entries disabled, with why, while the API is unreachable', () => {
    jest.mocked(useFeatureFlag).mockReturnValue(true);
    jest.mocked(useIsApiUnavailable).mockReturnValue(true);

    render(<RecipeMain />);

    const reasons = Object.fromEntries(
      lastMenu().map(action => [action.key, action.disabledReason]),
    );
    expect(reasons).toEqual({
      link: 'Needs a connection',
      photo: 'Needs a connection',
      text: 'Needs a connection',
      manual: undefined,
    });
  });
});
