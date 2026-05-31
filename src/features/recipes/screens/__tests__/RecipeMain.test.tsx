'use no memo';

import React from 'react';
import { render, userEvent, act } from '@testing-library/react-native';
import { RecipeMain } from '../RecipeMain';
import type { transformRecipeForDisplay } from '#/utils/recipeTransform';
import type {
  SearchRecipesResult,
  RecipeSearchResult,
} from '#/services/recipeApi/types';

type RecipeMainItem = ReturnType<typeof transformRecipeForDisplay>;

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
  headerRight?: React.ReactNode;
}

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  })),
  useFocusEffect: jest.fn(),
}));

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/navigation/useTabBarAddButton', () => ({
  useTabBarAddButton: jest.fn(),
}));
jest.mock('#/context/TabBarActionsContext', () => ({
  useTabBarSetters: jest.fn(() => ({
    scrollTabBarHidden: { value: false, set: jest.fn() },
    setScannerProps: jest.fn(),
    setAddProps: jest.fn(),
    setActiveTab: jest.fn(),
    setOverlayOpen: jest.fn(),
    setAddButtonRect: jest.fn(),
  })),
}));
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#hooks/performance/useTabScreenLifecycle', () => ({
  useTabScreenLifecycle: jest.fn(),
}));
jest.mock('#hooks/performance/useRenderTime', () => ({
  useRenderTime: jest.fn(),
}));

jest.mock('#features/recipes/hooks/useRecipeScreen', () => ({
  useRecipeScreen: jest.fn(() => ({
    userId: null,
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
    setActiveFilters: jest.fn(),
    activeFilterCount: 0,
    clearFilters: jest.fn(),
    handleTextSearch: jest.fn(),
    handleIngredientSearch: jest.fn(),
    handleRefresh: jest.fn(),
    clearSearch: jest.fn(),
    toggleIngredient: jest.fn(),
  })),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock(
  '#/components/organisms/SpotlightCoachMark/SpotlightCoachMark',
  () => ({ SpotlightCoachMark: () => null }),
);
jest.mock('#hooks/ui/useTutorialSequence', () => ({
  useTutorialSequence: jest.fn(() => ({
    currentStep: null,
    dismiss: jest.fn(),
    isActive: false,
  })),
}));
jest.mock('#hooks/useFeatureHint', () => ({}));
jest.mock('#/utils/recipeTransform', () => ({
  transformRecipeForDisplay: jest.fn(
    (r: SearchRecipesResult | RecipeSearchResult) => ({
      id: String(r.id),
      title: r.title,
      subtitle: 'test',
      badge: undefined,
      imageUrl: r.image,
      spoonacularId: r.id,
    }),
  ),
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: () => null,
  useBottomSheetScrollableCreator: jest.fn(
    () => require('react-native').ScrollView,
  ),
  useBottomSheetSpringConfigs: jest.fn(() => ({})),
}));
jest.mock('../RecipeSearch/IngredientSelectorSheet', () => {
  const R = require('react');
  return {
    IngredientSelectorSheet: R.forwardRef(() => null),
  };
});

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
jest.mock('#components/base/Skeleton/RecipeSkeleton', () => ({
  RecipeSkeleton: () => 'RecipeSkeleton',
}));
jest.mock('#components/molecules/TabScreenHeader', () => ({
  TabScreenHeader: ({ title, headerRight }: TabScreenHeaderMockProps) => {
    const R = require('react');
    const { View, Text } = require('react-native');
    return R.createElement(
      View,
      null,
      R.createElement(Text, null, title),
      headerRight || null,
    );
  },
}));
jest.mock('#components/molecules/SearchBar', () => ({
  SearchBar: () => 'SearchBar',
}));
jest.mock('#/styles/commonStyles', () => ({ commonStyles: {} }));
jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: 'CachedImage',
}));
jest.mock('#components/templates/BottomSheetAction', () => ({
  BottomSheetAction: () => null,
}));
jest.mock('../RecipeSearch/IngredientSelectorContext', () => ({
  IngredientSelectorProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useIngredientSelector: jest.fn(() => ({
    selectedIngredients: new Set(),
    toggleIngredient: jest.fn(),
  })),
}));

// Helper to create a useRecipeScreen mock with overrides
function mockScreenWith(overrides: Record<string, unknown>) {
  const { useRecipeScreen } = jest.requireMock(
    '#features/recipes/hooks/useRecipeScreen',
  );
  useRecipeScreen.mockReturnValue({
    userId: null,
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
    setActiveFilters: jest.fn(),
    activeFilterCount: 0,
    clearFilters: jest.fn(),
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

  it('shows header with saved, my recipes, and advanced search navigation', () => {
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
        items: [
          { id: '1', title: 'Soup', subtitle: '4 servings', spoonacularId: 1 },
        ],
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
    expect(capturedItems![0].title).toBe('Soup');
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
        items: [{ id: '1', title: 'P', subtitle: 's', spoonacularId: 1 }],
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
        items: [{ id: '1', title: 'R', subtitle: 's', spoonacularId: 1 }],
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

  it('navigates to RecipeDetail with externalSource for items', () => {
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
        items: [{ id: '999', title: 'R', subtitle: 's', spoonacularId: 999 }],
        loading: false,
        refresh: jest.fn(),
        pantryItems: [],
        hasPantryItems: false,
      },
      items: [{ id: '999', title: 'R', subtitle: 's' }],
    });

    let capturedOnItemPress: ((id: string | number) => void) | undefined;
    mockItemListImpl = (props: ItemListMockProps) => {
      capturedOnItemPress = props.onItemPress;
      return null;
    };

    render(<RecipeMain />);
    act(() => {
      capturedOnItemPress!('999');
    });
    expect(mockToRecipeDetail).toHaveBeenCalledWith({
      externalSource: 'SPOONACULAR',
      externalId: '999',
    });
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

  it('calls handleRefresh from useRecipeScreen on pull-to-refresh', () => {
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
    act(() => {
      capturedOnRefresh!();
    });
    expect(mockRefresh).toHaveBeenCalled();
  });
});
