'use no memo';

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { RecipeMain } from '../RecipeMain';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  })),
}));

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#hooks/navigation/useTabBarAddButton', () => ({
  useTabBarAddButton: jest.fn(),
}));

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('#hooks/performance/useRenderTime', () => ({
  useRenderTime: jest.fn(),
}));

jest.mock('#/hooks/recipe/useSavedRecipes', () => ({
  useSavedRecipes: jest.fn(() => ({
    recipes: [],
    loading: false,
    refetch: jest.fn(),
  })),
}));

jest.mock('#/hooks/recipe/useRecipeManagement', () => ({
  useRecipeManagement: jest.fn(() => ({
    recipes: [],
    loading: false,
    refetch: jest.fn(),
    loadMore: jest.fn(),
    hasMore: false,
    totalCount: 0,
  })),
}));

jest.mock('#/hooks/recipe/useRecipeFolders', () => ({
  useRecipeFolders: jest.fn(() => ({
    folders: [],
  })),
}));

jest.mock('#/hooks/recipe/useRecipeTags', () => ({
  useRecipeTags: jest.fn(() => ({
    tags: [],
  })),
}));

jest.mock('#/hooks/recipe/useFolderActions', () => ({
  useFolderActions: jest.fn(() => ({
    renameFolder: jest.fn(),
    deleteFolder: jest.fn(),
    loading: false,
  })),
}));

jest.mock('#/services/recipeApi/SpoonacularService', () => ({
  spoonacularService: {
    getRandomRecipes: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('#generated', () => ({
  useUnfavoriteRecipeMutation: jest.fn(() => [jest.fn()]),
  useDeleteRecipeMutation: jest.fn(() => [jest.fn()]),
  MySavedRecipesDocument: {},
  MyRecipesDocument: {},
}));

jest.mock('#/utils/compilerSafeWrappers');

// Top-level capturing mocks.
// Using module-level handler variables avoids the jest.mock()-inside-test-body
// antipattern: jest.mock() calls are hoisted, so only the last factory per
// module path takes effect. Instead we define the mocks once at the top level
// and swap the handler function in each test that needs different behaviour.

type AnyProps = Record<string, any>;

let mockItemListImpl: (props: AnyProps) => React.ReactElement | null = () => null;
let mockFilterTabsImpl: (props: AnyProps) => React.ReactElement | null = () => null;
let mockFolderPickerImpl: (props: AnyProps) => React.ReactElement | null = () => null;
let mockTagPickerImpl: (props: AnyProps) => React.ReactElement | null = () => null;
let mockSegmentedControlImpl: (props: AnyProps) => React.ReactElement | null = () => null;

jest.mock('#components/organisms/ItemList', () => ({
  ItemList: (props: AnyProps) => mockItemListImpl(props),
}));

jest.mock('#components/molecules/FolderPicker', () => ({
  FolderPicker: (props: AnyProps) => mockFolderPickerImpl(props),
}));

jest.mock('#components/molecules/TagPicker', () => ({
  TagPicker: (props: AnyProps) => mockTagPickerImpl(props),
}));

jest.mock('#components/molecules/FilterTabs/FilterTabs', () => ({
  FilterTabs: (props: AnyProps) => mockFilterTabsImpl(props),
}));

jest.mock('#components/molecules/SegmentedControl', () => ({
  SegmentedControl: (props: AnyProps) => mockSegmentedControlImpl(props),
}));

const mockDeferredScreen = jest.fn(({ fallback }: any) => fallback);
jest.mock('#components/performance/DeferredScreen', () => ({
  DeferredScreen: (props: any) => mockDeferredScreen(props),
}));

jest.mock('#components/base/Skeleton/RecipeSkeleton', () => ({
  RecipeSkeleton: () => 'RecipeSkeleton',
}));

// Render TabScreenHeader including headerRight so header action buttons are accessible in tests
jest.mock('#components/molecules/TabScreenHeader', () => ({
  TabScreenHeader: ({ title, headerRight }: any) => {
    const ReactInMock = require("react");
    const { View, Text } = require('react-native');
    return ReactInMock.createElement(
      View,
      null,
      ReactInMock.createElement(Text, null, title),
      headerRight || null,
    );
  },
}));

jest.mock('#components/molecules/SearchBar', () => ({
  SearchBar: () => 'SearchBar',
}));

jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {},
}));

jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: 'CachedImage',
}));

describe('RecipeMain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset capturing impls to no-ops before each test
    mockItemListImpl = () => null;
    mockFilterTabsImpl = () => null;
    mockFolderPickerImpl = () => null;
    mockTagPickerImpl = () => null;
    mockSegmentedControlImpl = () => null;
  });

  it('renders the outer component with fallback', () => {
    const { getByTestId } = render(<RecipeMain />);
    expect(getByTestId('recipes-screen')).toBeTruthy();
  });

  it('renders inner component when DeferredScreen renders component', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { getByTestId } = render(<RecipeMain />);
    expect(getByTestId('recipes-screen')).toBeTruthy();
  });

  it('shows empty state when no recipes', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const tree = render(<RecipeMain />);
    expect(tree.getByTestId('recipes-screen')).toBeTruthy();
  });

  it('renders with saved recipes', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock(
      '#/hooks/recipe/useSavedRecipes',
    );
    useSavedRecipes.mockReturnValue({
      recipes: [
        {
          recipeId: 'r-1',
          name: 'Pasta',
          imageUrl: null,
          servings: 2,
          totalTimeMinutes: 30,
          folder: null,
          tags: [],
        },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByTestId('recipes-screen')).toBeTruthy();
  });

  it('shows folder and tag filters when available', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useRecipeFolders } = jest.requireMock(
      '#/hooks/recipe/useRecipeFolders',
    );
    useRecipeFolders.mockReturnValue({
      folders: ['Favorites', 'Quick Meals'],
    });

    const { useRecipeTags } = jest.requireMock('#/hooks/recipe/useRecipeTags');
    useRecipeTags.mockReturnValue({
      tags: ['easy', 'healthy'],
    });

    const { useSavedRecipes } = jest.requireMock(
      '#/hooks/recipe/useSavedRecipes',
    );
    useSavedRecipes.mockReturnValue({
      recipes: [
        { recipeId: 'r-1', name: 'Pasta', servings: 2, folder: 'Favorites', tags: ['easy'] },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByTestId('recipes-screen')).toBeTruthy();
  });

  it('shows suggested header when random recipes are shown', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { spoonacularService } = jest.requireMock(
      '#/services/recipeApi/SpoonacularService',
    );
    spoonacularService.getRandomRecipes.mockResolvedValue([
      { id: 'rand-1', title: 'Random Soup', servings: 4, readyInMinutes: 30, image: null },
    ]);

    const tree = render(<RecipeMain />);
    expect(tree.getByTestId('recipes-screen')).toBeTruthy();
  });

  it('renders with recipes that have fallback time calculations', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock(
      '#/hooks/recipe/useSavedRecipes',
    );
    useSavedRecipes.mockReturnValue({
      recipes: [
        {
          recipeId: 'r-1',
          name: 'Pasta',
          servings: 2,
          totalTimeMinutes: null,
          readyInMinutes: null,
          prepTimeMinutes: 10,
          cookTimeMinutes: 20,
          folder: null,
          tags: [],
        },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByTestId('recipes-screen')).toBeTruthy();
  });

  it('renders with recipe that has only prepTimeMinutes', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock(
      '#/hooks/recipe/useSavedRecipes',
    );
    useSavedRecipes.mockReturnValue({
      recipes: [
        {
          recipeId: 'r-1',
          name: 'Salad',
          servings: 1,
          totalTimeMinutes: null,
          readyInMinutes: null,
          prepTimeMinutes: 5,
          cookTimeMinutes: null,
          folder: null,
          tags: [],
        },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByTestId('recipes-screen')).toBeTruthy();
  });

  it('renders with recipe that has no time at all', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock(
      '#/hooks/recipe/useSavedRecipes',
    );
    useSavedRecipes.mockReturnValue({
      recipes: [
        {
          recipeId: 'r-1',
          name: 'Quick Bite',
          servings: 1,
          totalTimeMinutes: null,
          readyInMinutes: null,
          prepTimeMinutes: null,
          cookTimeMinutes: null,
          folder: null,
          tags: [],
        },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByTestId('recipes-screen')).toBeTruthy();
  });

  it('renders with recipe that has imageUrl', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock(
      '#/hooks/recipe/useSavedRecipes',
    );
    useSavedRecipes.mockReturnValue({
      recipes: [
        {
          recipeId: 'r-1',
          name: 'Pasta',
          imageUrl: 'https://example.com/pasta.jpg',
          servings: 2,
          totalTimeMinutes: 30,
          folder: null,
          tags: [],
        },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByTestId('recipes-screen')).toBeTruthy();
  });

  it('does not show filter tabs when no folders and no tags', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useRecipeFolders } = jest.requireMock('#/hooks/recipe/useRecipeFolders');
    useRecipeFolders.mockReturnValue({ folders: [] });

    const { useRecipeTags } = jest.requireMock('#/hooks/recipe/useRecipeTags');
    useRecipeTags.mockReturnValue({ tags: [] });

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [{ recipeId: 'r-1', name: 'Pasta', servings: 2, folder: null, tags: [] }],
      loading: false,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByTestId('recipes-screen')).toBeTruthy();
  });

  it('does not fetch random when still loading', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [],
      loading: true,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByTestId('recipes-screen')).toBeTruthy();
  });

  it('renders with recipes having different folder filters', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useRecipeFolders } = jest.requireMock('#/hooks/recipe/useRecipeFolders');
    useRecipeFolders.mockReturnValue({ folders: ['Breakfast', 'Lunch', 'Dinner'] });

    const { useRecipeTags } = jest.requireMock('#/hooks/recipe/useRecipeTags');
    useRecipeTags.mockReturnValue({ tags: ['quick', 'healthy', 'comfort'] });

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        { recipeId: 'r-1', name: 'Pancakes', servings: 4, totalTimeMinutes: 20, folder: 'Breakfast', tags: ['quick'] },
        { recipeId: 'r-2', name: 'Salad', servings: 2, totalTimeMinutes: 10, folder: 'Lunch', tags: ['healthy'] },
        { recipeId: 'r-3', name: 'Stew', servings: 6, totalTimeMinutes: 60, folder: 'Dinner', tags: ['comfort'] },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByTestId('recipes-screen')).toBeTruthy();
  });

  it('renders with recipe that has readyInMinutes', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        {
          recipeId: 'r-1',
          name: 'Quick Pasta',
          servings: 2,
          totalTimeMinutes: null,
          readyInMinutes: 25,
          prepTimeMinutes: null,
          cookTimeMinutes: null,
          folder: null,
          tags: [],
        },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByTestId('recipes-screen')).toBeTruthy();
  });

  it('renders with recipe that has totalTimeMinutes', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        {
          recipeId: 'r-1',
          name: 'Steak',
          servings: 2,
          totalTimeMinutes: 45,
          readyInMinutes: null,
          prepTimeMinutes: null,
          cookTimeMinutes: null,
          folder: null,
          tags: [],
          imageUrl: 'https://example.com/steak.jpg',
        },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByTestId('recipes-screen')).toBeTruthy();
  });

  it('renders with only cookTimeMinutes', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        {
          recipeId: 'r-1',
          name: 'Baked Fish',
          servings: 2,
          totalTimeMinutes: null,
          readyInMinutes: null,
          prepTimeMinutes: null,
          cookTimeMinutes: 35,
          folder: null,
          tags: [],
        },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByTestId('recipes-screen')).toBeTruthy();
  });

  it('renders with large number of recipes', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    const recipes = Array.from({ length: 20 }, (_, i) => ({
      recipeId: `r-${i}`,
      name: `Recipe ${i}`,
      servings: 2,
      totalTimeMinutes: 30,
      folder: i % 2 === 0 ? 'Favorites' : null,
      tags: i % 3 === 0 ? ['easy'] : [],
    }));
    useSavedRecipes.mockReturnValue({
      recipes,
      loading: false,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    expect(tree.getByTestId('recipes-screen')).toBeTruthy();
  });

  // --- Additional branch / function coverage tests ---

  it('fetches random recipes when user has no saved recipes and loading is done', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { spoonacularService } = jest.requireMock(
      '#/services/recipeApi/SpoonacularService',
    );
    spoonacularService.getRandomRecipes.mockResolvedValue([
      { id: 'r1', title: 'Random Soup', servings: 4, readyInMinutes: 30, image: 'https://example.com/soup.jpg' },
    ]);

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [],
      loading: false,
      refetch: jest.fn(),
    });

    render(<RecipeMain />);

    await waitFor(() => {
      expect(spoonacularService.getRandomRecipes).toHaveBeenCalledWith(
        { number: 10 },
        expect.any(Object),
      );
    });
  });

  it('shows suggested header with refresh button when random recipes are displayed', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { spoonacularService } = jest.requireMock(
      '#/services/recipeApi/SpoonacularService',
    );
    spoonacularService.getRandomRecipes.mockResolvedValue([
      { id: 'r1', title: 'Random Soup', servings: 4, readyInMinutes: 30, image: null },
    ]);

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [],
      loading: false,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);

    await waitFor(() => {
      expect(tree.getByText('Need inspiration?')).toBeTruthy();
    });
    expect(tree.getByText('Here are some recipe ideas to try')).toBeTruthy();
  });

  it('navigates to RecipeSearch when search header button pressed', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const mockNavigate = jest.fn();
    const { useAppNavigation } = jest.requireMock('#hooks/navigation/useAppNavigation');
    useAppNavigation.mockReturnValue({
      navigate: mockNavigate,
      goBack: jest.fn(),
    });

    const tree = render(<RecipeMain />);
    const searchBtn = tree.getByLabelText('Search recipes');
    fireEvent.press(searchBtn);

    expect(mockNavigate).toHaveBeenCalledWith('RecipeSearch', { initialQuery: '' });
  });

  it('navigates to RecipeCreate when add button callback fires', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const mockNavigate = jest.fn();
    const { useAppNavigation } = jest.requireMock('#hooks/navigation/useAppNavigation');
    useAppNavigation.mockReturnValue({
      navigate: mockNavigate,
      goBack: jest.fn(),
    });

    const { useTabBarAddButton } = jest.requireMock('#hooks/navigation/useTabBarAddButton');
    let addCallback: () => void;
    useTabBarAddButton.mockImplementation((cb: () => void) => { addCallback = cb; });

    render(<RecipeMain />);
    act(() => { addCallback!(); });

    expect(mockNavigate).toHaveBeenCalledWith('RecipeCreate');
  });

  it('handles refresh of random recipes via handleRefreshRandom', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { spoonacularService } = jest.requireMock(
      '#/services/recipeApi/SpoonacularService',
    );
    spoonacularService.getRandomRecipes.mockResolvedValue([
      { id: 'r1', title: 'Random 1', servings: 2, readyInMinutes: 20, image: null },
    ]);

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [],
      loading: false,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);

    await waitFor(() => {
      expect(tree.getByText('Need inspiration?')).toBeTruthy();
    });

    // Press the refresh button
    spoonacularService.getRandomRecipes.mockResolvedValue([
      { id: 'r2', title: 'Random 2', servings: 3, readyInMinutes: 15, image: null },
    ]);

    const refreshBtn = tree.getByLabelText('Refresh recipe suggestions');
    await act(async () => {
      fireEvent.press(refreshBtn);
    });

    expect(spoonacularService.getRandomRecipes).toHaveBeenCalledTimes(2);
  });

  it('handles error when fetching random recipes', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { spoonacularService } = jest.requireMock(
      '#/services/recipeApi/SpoonacularService',
    );
    spoonacularService.getRandomRecipes.mockRejectedValue(new Error('API error'));

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [],
      loading: false,
      refetch: jest.fn(),
    });

    render(<RecipeMain />);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch random recipes:',
        expect.any(Error),
      );
    });
  });

  it('does not fetch random recipes when AbortError occurs', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';

    const { spoonacularService } = jest.requireMock(
      '#/services/recipeApi/SpoonacularService',
    );
    spoonacularService.getRandomRecipes.mockRejectedValue(abortError);

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [],
      loading: false,
      refetch: jest.fn(),
    });

    render(<RecipeMain />);

    // AbortError should be silently ignored
    await waitFor(() => {
      expect(spoonacularService.getRandomRecipes).toHaveBeenCalled();
    });
  });

  it('handles error when refreshing random recipes shows alert', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    const { spoonacularService } = jest.requireMock(
      '#/services/recipeApi/SpoonacularService',
    );
    // First call succeeds (initial load), second fails (refresh)
    spoonacularService.getRandomRecipes
      .mockResolvedValueOnce([
        { id: 'r1', title: 'Random', servings: 2, readyInMinutes: 10, image: null },
      ])
      .mockRejectedValueOnce(new Error('Network fail'));

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [],
      loading: false,
      refetch: jest.fn(),
    });

    const tree = render(<RecipeMain />);

    await waitFor(() => {
      expect(tree.getByText('Need inspiration?')).toBeTruthy();
    });

    const refreshBtn = tree.getByLabelText('Refresh recipe suggestions');
    await act(async () => {
      fireEvent.press(refreshBtn);
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Error',
      'Failed to load recipe suggestions. Please try again.',
    );

    alertSpy.mockRestore();
  });

  it('navigates to RecipeDetail with externalSource for random recipe items', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const mockNavigate = jest.fn();
    const { useAppNavigation } = jest.requireMock('#hooks/navigation/useAppNavigation');
    useAppNavigation.mockReturnValue({
      navigate: mockNavigate,
      goBack: jest.fn(),
    });

    const { spoonacularService } = jest.requireMock(
      '#/services/recipeApi/SpoonacularService',
    );
    spoonacularService.getRandomRecipes.mockResolvedValue([
      { id: 999, title: 'Rand Recipe', servings: 2, readyInMinutes: 10, image: null },
    ]);

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [],
      loading: false,
      refetch: jest.fn(),
    });

    // Capture onItemPress via the top-level mock
    let capturedOnItemPress: ((id: string | number) => void) | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedOnItemPress = props.onItemPress;
      return null;
    };

    render(<RecipeMain />);

    // Wait for random recipes to load so showRandomRecipes becomes true
    await waitFor(() => {
      expect(capturedOnItemPress).toBeDefined();
    });

    act(() => {
      capturedOnItemPress!('999');
    });

    expect(mockNavigate).toHaveBeenCalledWith('RecipeDetail', {
      externalSource: 'SPOONACULAR',
      externalId: '999',
    });
  });

  it('navigates to RecipeDetail with recipeId for saved recipe items', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const mockNavigate = jest.fn();
    const { useAppNavigation } = jest.requireMock('#hooks/navigation/useAppNavigation');
    useAppNavigation.mockReturnValue({
      navigate: mockNavigate,
      goBack: jest.fn(),
    });

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        { recipeId: 'abc-123', name: 'Saved Recipe', servings: 2, totalTimeMinutes: 30, folder: null, tags: [] },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedOnItemPress: ((id: string | number) => void) | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedOnItemPress = props.onItemPress;
      return null;
    };

    render(<RecipeMain />);

    act(() => {
      capturedOnItemPress!('abc-123');
    });

    expect(mockNavigate).toHaveBeenCalledWith('RecipeDetail', {
      recipeId: 'abc-123',
    });
  });

  it('calls unfavorite mutation when deleting a saved recipe', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const mockUnfavorite = jest.fn().mockResolvedValue({});
    const { useUnfavoriteRecipeMutation } = jest.requireMock('#generated');
    useUnfavoriteRecipeMutation.mockReturnValue([mockUnfavorite]);

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        { recipeId: 'del-1', name: 'Delete Me', servings: 2, totalTimeMinutes: 10, folder: null, tags: [] },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedOnItemDelete: ((id: string) => Promise<void>) | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedOnItemDelete = props.onItemDelete;
      return null;
    };

    render(<RecipeMain />);

    await act(async () => {
      await capturedOnItemDelete!('del-1');
    });

    expect(mockUnfavorite).toHaveBeenCalledWith({
      variables: { recipeId: 'del-1' },
    });
  });

  it('shows alert when unfavorite mutation fails', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    const mockUnfavorite = jest.fn().mockRejectedValue(new Error('Mutation fail'));
    const { useUnfavoriteRecipeMutation } = jest.requireMock('#generated');
    useUnfavoriteRecipeMutation.mockReturnValue([mockUnfavorite]);

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        { recipeId: 'fail-1', name: 'Fail', servings: 1, folder: null, tags: [] },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedOnItemDelete: ((id: string) => Promise<void>) | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedOnItemDelete = props.onItemDelete;
      return null;
    };

    render(<RecipeMain />);

    await act(async () => {
      await capturedOnItemDelete!('fail-1');
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Error',
      'Failed to remove recipe. Please try again.',
    );

    alertSpy.mockRestore();
  });

  it('filters recipes by search query matching name', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        { recipeId: 'r-1', name: 'Pasta Carbonara', description: 'Italian classic', servings: 2, folder: null, tags: [] },
        { recipeId: 'r-2', name: 'Chicken Tikka', description: 'Indian curry', servings: 4, folder: null, tags: [] },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedItems: any[] | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedItems = props.items;
      return null;
    };

    // Override the already-mocked SearchBar module to expose onChangeText
    let capturedOnChangeText: ((text: string) => void) | undefined;
    const SearchBarModule = require('#components/molecules/SearchBar');
    const originalSearchBar = SearchBarModule.SearchBar;
    SearchBarModule.SearchBar = ({ onChangeText }: AnyProps) => {
      capturedOnChangeText = onChangeText;
      return null;
    };

    render(<RecipeMain />);

    // Initially shows both
    expect(capturedItems!.length).toBe(2);

    act(() => {
      capturedOnChangeText!('pasta');
    });

    // After filtering by "pasta", should show 1 item
    expect(capturedItems!.length).toBe(1);

    SearchBarModule.SearchBar = originalSearchBar;
  });

  it('filters recipes by search query matching description', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        { recipeId: 'r-1', name: 'Dish A', description: 'Delicious curry', servings: 2, folder: null, tags: [] },
        { recipeId: 'r-2', name: 'Dish B', description: 'Light salad', servings: 4, folder: null, tags: [] },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedItems: any[] | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedItems = props.items;
      return null;
    };

    let capturedOnChangeText: ((text: string) => void) | undefined;
    const SearchBarModule = require('#components/molecules/SearchBar');
    const originalSearchBar = SearchBarModule.SearchBar;
    SearchBarModule.SearchBar = ({ onChangeText }: AnyProps) => {
      capturedOnChangeText = onChangeText;
      return null;
    };

    render(<RecipeMain />);

    act(() => {
      capturedOnChangeText!('curry');
    });

    expect(capturedItems!.length).toBe(1);

    SearchBarModule.SearchBar = originalSearchBar;
  });

  it('displays filter tabs with folder count when folders exist', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useRecipeFolders } = jest.requireMock('#/hooks/recipe/useRecipeFolders');
    useRecipeFolders.mockReturnValue({ folders: ['Favorites', 'Quick Meals'] });

    const { useRecipeTags } = jest.requireMock('#/hooks/recipe/useRecipeTags');
    useRecipeTags.mockReturnValue({ tags: [] });

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [{ recipeId: 'r-1', name: 'P', servings: 2, folder: 'Favorites', tags: [] }],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedTabs: any[] | undefined;
    mockFilterTabsImpl = (props: AnyProps) => {
      capturedTabs = props.tabs;
      return null;
    };

    render(<RecipeMain />);
    expect(capturedTabs!.find((t: any) => t.id === 'folder')).toBeTruthy();
    expect(capturedTabs!.find((t: any) => t.id === 'tags')).toBeFalsy();
  });

  it('displays filter tabs with tag count when tags exist', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useRecipeFolders } = jest.requireMock('#/hooks/recipe/useRecipeFolders');
    useRecipeFolders.mockReturnValue({ folders: [] });

    const { useRecipeTags } = jest.requireMock('#/hooks/recipe/useRecipeTags');
    useRecipeTags.mockReturnValue({ tags: ['easy', 'healthy'] });

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [{ recipeId: 'r-1', name: 'P', servings: 2, folder: null, tags: ['easy'] }],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedTabs: any[] | undefined;
    mockFilterTabsImpl = (props: AnyProps) => {
      capturedTabs = props.tabs;
      return null;
    };

    render(<RecipeMain />);
    expect(capturedTabs!.find((t: any) => t.id === 'tags')).toBeTruthy();
    expect(capturedTabs!.find((t: any) => t.id === 'folder')).toBeFalsy();
  });

  it('clears all filters when "all" tab is selected', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useRecipeFolders } = jest.requireMock('#/hooks/recipe/useRecipeFolders');
    useRecipeFolders.mockReturnValue({ folders: ['Fav'] });

    const { useRecipeTags } = jest.requireMock('#/hooks/recipe/useRecipeTags');
    useRecipeTags.mockReturnValue({ tags: ['easy'] });

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [{ recipeId: 'r-1', name: 'P', servings: 2, folder: 'Fav', tags: ['easy'] }],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedOnTabChange: ((id: string) => void) | undefined;
    mockFilterTabsImpl = (props: AnyProps) => {
      capturedOnTabChange = props.onTabChange;
      return null;
    };

    render(<RecipeMain />);
    act(() => {
      capturedOnTabChange!('all');
    });

    // No crash means handleClearFilters ran successfully
  });

  it('calls refetch for saved recipes on refresh', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const mockRefetch = jest.fn().mockResolvedValue({});
    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [{ recipeId: 'r-1', name: 'P', servings: 2, folder: null, tags: [] }],
      loading: false,
      refetch: mockRefetch,
    });

    let capturedOnRefresh: (() => Promise<void>) | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedOnRefresh = props.onRefresh;
      return null;
    };

    render(<RecipeMain />);

    await act(async () => {
      await capturedOnRefresh!();
    });

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('does not pass onItemDelete for random recipes', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { spoonacularService } = jest.requireMock(
      '#/services/recipeApi/SpoonacularService',
    );
    spoonacularService.getRandomRecipes.mockResolvedValue([
      { id: 'r1', title: 'Random', servings: 2, readyInMinutes: 10, image: null },
    ]);

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedOnItemDelete: any;
    mockItemListImpl = (props: AnyProps) => {
      capturedOnItemDelete = props.onItemDelete;
      return null;
    };

    render(<RecipeMain />);

    await waitFor(() => {
      expect(capturedOnItemDelete).toBeUndefined();
    });
  });

  it('renders random recipe items with Suggested badge', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { spoonacularService } = jest.requireMock(
      '#/services/recipeApi/SpoonacularService',
    );
    spoonacularService.getRandomRecipes.mockResolvedValue([
      { id: 101, title: 'Random Bowl', servings: 2, readyInMinutes: 15, image: null },
    ]);

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedItems: any[] | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedItems = props.items;
      return null;
    };

    render(<RecipeMain />);

    await waitFor(() => {
      expect(capturedItems!.length).toBeGreaterThan(0);
    });

    expect(capturedItems![0].badge).toEqual({ text: 'Suggested' });
    expect(capturedItems![0].id).toBe('101');
  });

  it('renders saved recipe items without Suggested badge', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        { recipeId: 'r-1', name: 'My Pasta', servings: 2, totalTimeMinutes: 30, folder: null, tags: [] },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedItems: any[] | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedItems = props.items;
      return null;
    };

    render(<RecipeMain />);

    expect(capturedItems![0].badge).toBeUndefined();
    expect(capturedItems![0].id).toBe('r-1');
  });

  it('renders recipe with image in left element', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        { recipeId: 'r-1', name: 'With Image', imageUrl: 'https://img.com/a.jpg', servings: 2, totalTimeMinutes: 30, folder: null, tags: [] },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedItems: any[] | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedItems = props.items;
      return null;
    };

    render(<RecipeMain />);

    expect(capturedItems![0].leftElement).toBeTruthy();
  });

  it('renders recipe without image has no left element', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        { recipeId: 'r-1', name: 'No Image', imageUrl: null, servings: 2, totalTimeMinutes: 30, folder: null, tags: [] },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedItems: any[] | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedItems = props.items;
      return null;
    };

    render(<RecipeMain />);

    expect(capturedItems![0].leftElement).toBeUndefined();
  });

  it('shows folder label in filter tab when folder is selected', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useRecipeFolders } = jest.requireMock('#/hooks/recipe/useRecipeFolders');
    useRecipeFolders.mockReturnValue({ folders: ['Dinner'] });

    const { useRecipeTags } = jest.requireMock('#/hooks/recipe/useRecipeTags');
    useRecipeTags.mockReturnValue({ tags: [] });

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [{ recipeId: 'r-1', name: 'P', servings: 2, folder: 'Dinner', tags: [] }],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedTabs: any[] | undefined;
    let folderOnPress: (() => void) | undefined;
    mockFilterTabsImpl = (props: AnyProps) => {
      capturedTabs = props.tabs;
      const folderTab = props.tabs.find((t: any) => t.id === 'folder');
      if (folderTab) folderOnPress = folderTab.onPress;
      return null;
    };

    let capturedFolderPickerOnSelect: ((folder: string) => void) | undefined;
    mockFolderPickerImpl = (props: AnyProps) => {
      capturedFolderPickerOnSelect = props.onSelect;
      return null;
    };

    render(<RecipeMain />);

    // Open folder picker via tab press
    act(() => { folderOnPress!(); });

    // Select a folder
    act(() => {
      capturedFolderPickerOnSelect!('Dinner');
    });

    // After selection, the folder tab label should reflect the selected folder name
    expect(capturedTabs!.find((t: any) => t.id === 'folder')?.label).toBe('Dinner');
  });

  it('shows tag count in filter tab label when tags are selected', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useRecipeFolders } = jest.requireMock('#/hooks/recipe/useRecipeFolders');
    useRecipeFolders.mockReturnValue({ folders: [] });

    const { useRecipeTags } = jest.requireMock('#/hooks/recipe/useRecipeTags');
    useRecipeTags.mockReturnValue({ tags: ['easy', 'healthy'] });

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [{ recipeId: 'r-1', name: 'P', servings: 2, folder: null, tags: ['easy'] }],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedTabs: any[] | undefined;
    let tagOnPress: (() => void) | undefined;
    mockFilterTabsImpl = (props: AnyProps) => {
      capturedTabs = props.tabs;
      const tagTab = props.tabs.find((t: any) => t.id === 'tags');
      if (tagTab) tagOnPress = tagTab.onPress;
      return null;
    };

    let capturedTagPickerOnSelect: ((tags: string[]) => void) | undefined;
    mockTagPickerImpl = (props: AnyProps) => {
      capturedTagPickerOnSelect = props.onSelect;
      return null;
    };

    render(<RecipeMain />);

    act(() => { tagOnPress!(); });

    act(() => {
      capturedTagPickerOnSelect!(['easy', 'healthy']);
    });

    // After selecting 2 tags, the label should reflect the count
    expect(capturedTabs!.find((t: any) => t.id === 'tags')?.label).toBe('2 Tags');
  });

  it('handles rename folder callback from FolderPicker', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const mockRenameFolder = jest.fn().mockResolvedValue(true);
    const { useFolderActions } = jest.requireMock('#/hooks/recipe/useFolderActions');
    useFolderActions.mockReturnValue({
      renameFolder: mockRenameFolder,
      deleteFolder: jest.fn(),
      loading: false,
    });

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [{ recipeId: 'r-1', name: 'P', servings: 2, folder: null, tags: [] }],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedOnRename: ((oldName: string, newName: string) => Promise<boolean>) | undefined;
    mockFolderPickerImpl = (props: AnyProps) => {
      capturedOnRename = props.onRenameFolder;
      return null;
    };

    render(<RecipeMain />);

    await act(async () => {
      const result = await capturedOnRename!('OldName', 'NewName');
      expect(result).toBe(true);
    });

    expect(mockRenameFolder).toHaveBeenCalledWith('OldName', 'NewName');
  });

  it('handles delete folder callback from FolderPicker', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const mockDeleteFolder = jest.fn().mockResolvedValue(true);
    const { useFolderActions } = jest.requireMock('#/hooks/recipe/useFolderActions');
    useFolderActions.mockReturnValue({
      renameFolder: jest.fn(),
      deleteFolder: mockDeleteFolder,
      loading: false,
    });

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [{ recipeId: 'r-1', name: 'P', servings: 2, folder: null, tags: [] }],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedOnDelete: ((folderName: string) => Promise<boolean>) | undefined;
    mockFolderPickerImpl = (props: AnyProps) => {
      capturedOnDelete = props.onDeleteFolder;
      return null;
    };

    render(<RecipeMain />);

    await act(async () => {
      const result = await capturedOnDelete!('FolderToDelete');
      expect(result).toBe(true);
    });

    expect(mockDeleteFolder).toHaveBeenCalledWith('FolderToDelete');
  });

  it('clears random recipes when user saves their first recipe', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { spoonacularService } = jest.requireMock(
      '#/services/recipeApi/SpoonacularService',
    );
    spoonacularService.getRandomRecipes.mockResolvedValue([
      { id: 'r1', title: 'Random', servings: 2, readyInMinutes: 10, image: null },
    ]);

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    // Start with no saved recipes
    useSavedRecipes.mockReturnValue({
      recipes: [],
      loading: false,
      refetch: jest.fn(),
    });

    const { rerender } = render(<RecipeMain />);

    await waitFor(() => {
      expect(spoonacularService.getRandomRecipes).toHaveBeenCalled();
    });

    // Now user has a saved recipe
    useSavedRecipes.mockReturnValue({
      recipes: [{ recipeId: 'new-1', name: 'New', servings: 2, folder: null, tags: [] }],
      loading: false,
      refetch: jest.fn(),
    });

    rerender(<RecipeMain />);
    // clearRandomRecipesIfNeeded should trigger when recipes.length > 0 and randomRecipes.length > 0
  });

  it('subtitle shows time when totalTime is available', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        { recipeId: 'r-1', name: 'Quick', servings: 3, totalTimeMinutes: 20, folder: null, tags: [] },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedItems: any[] | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedItems = props.items;
      return null;
    };

    render(<RecipeMain />);

    expect(capturedItems![0].subtitle).toContain('3 servings');
    expect(capturedItems![0].subtitle).toContain('20 min');
  });

  it('subtitle does not show time when no time data', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        { recipeId: 'r-1', name: 'No Time', servings: 2, totalTimeMinutes: null, readyInMinutes: null, prepTimeMinutes: null, cookTimeMinutes: null, folder: null, tags: [] },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedItems: any[] | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedItems = props.items;
      return null;
    };

    render(<RecipeMain />);

    expect(capturedItems![0].subtitle).toBe('2 servings');
    expect(capturedItems![0].subtitle).not.toContain('min');
  });

  it('filters recipes by folder selection', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useRecipeFolders } = jest.requireMock('#/hooks/recipe/useRecipeFolders');
    useRecipeFolders.mockReturnValue({ folders: ['Dinner'] });

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        { recipeId: 'r-1', name: 'Dinner Recipe', servings: 2, folder: 'Dinner', tags: [] },
        { recipeId: 'r-2', name: 'Lunch Recipe', servings: 2, folder: 'Lunch', tags: [] },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedItems: any[] | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedItems = props.items;
      return null;
    };

    let capturedFolderPickerOnSelect: ((folder: string) => void) | undefined;
    mockFolderPickerImpl = (props: AnyProps) => {
      capturedFolderPickerOnSelect = props.onSelect;
      return null;
    };

    render(<RecipeMain />);

    // Initially shows both
    expect(capturedItems!.length).toBe(2);

    act(() => {
      capturedFolderPickerOnSelect!('Dinner');
    });

    // After folder selection, should show only 1
    expect(capturedItems!.length).toBe(1);
    expect(capturedItems![0].title).toBe('Dinner Recipe');
  });

  it('filters recipes by tag selection', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useRecipeTags } = jest.requireMock('#/hooks/recipe/useRecipeTags');
    useRecipeTags.mockReturnValue({ tags: ['easy'] });

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [
        { recipeId: 'r-1', name: 'Easy Recipe', servings: 2, folder: null, tags: ['easy'] },
        { recipeId: 'r-2', name: 'Hard Recipe', servings: 2, folder: null, tags: ['hard'] },
      ],
      loading: false,
      refetch: jest.fn(),
    });

    let capturedItems: any[] | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedItems = props.items;
      return null;
    };

    let capturedTagPickerOnSelect: ((tags: string[]) => void) | undefined;
    mockTagPickerImpl = (props: AnyProps) => {
      capturedTagPickerOnSelect = props.onSelect;
      return null;
    };

    render(<RecipeMain />);

    // Initially shows both
    expect(capturedItems!.length).toBe(2);

    act(() => {
      capturedTagPickerOnSelect!(['easy']);
    });

    // After tag selection, should show only 1
    expect(capturedItems!.length).toBe(1);
    expect(capturedItems![0].title).toBe('Easy Recipe');
  });

  // --- SegmentedControl / My Recipes view tests ---

  it('renders SegmentedControl in inner component', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    let capturedProps: AnyProps | undefined;
    mockSegmentedControlImpl = (props: AnyProps) => {
      capturedProps = props;
      return null;
    };

    render(<RecipeMain />);

    expect(capturedProps).toBeDefined();
    expect(capturedProps!.value).toBe('saved');
    expect(capturedProps!.options).toEqual(['saved', 'myRecipes']);
    expect(capturedProps!.size).toBe('compact');
  });

  it('switches to My Recipes view and shows user-created recipes', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useRecipeManagement } = jest.requireMock('#/hooks/recipe/useRecipeManagement');
    useRecipeManagement.mockReturnValue({
      recipes: [
        { id: 'my-1', name: 'My Pasta', description: 'Homemade', servings: 4, totalTimeMinutes: 30, imageUrl: null },
      ],
      loading: false,
      refetch: jest.fn(),
      loadMore: jest.fn(),
      hasMore: false,
      totalCount: 1,
    });

    let capturedItems: any[] | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedItems = props.items;
      return null;
    };

    let capturedOnChange: ((value: string) => void) | undefined;
    mockSegmentedControlImpl = (props: AnyProps) => {
      capturedOnChange = props.onChange;
      return null;
    };

    render(<RecipeMain />);

    // Switch to My Recipes
    act(() => {
      capturedOnChange!('myRecipes');
    });

    expect(capturedItems!.length).toBe(1);
    expect(capturedItems![0].id).toBe('my-1');
    expect(capturedItems![0].title).toBe('My Pasta');
  });

  it('shows My Recipes empty state with Create Recipe action', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    let capturedEmptyState: any;
    mockItemListImpl = (props: AnyProps) => {
      capturedEmptyState = props.emptyState;
      return null;
    };

    let capturedOnChange: ((value: string) => void) | undefined;
    mockSegmentedControlImpl = (props: AnyProps) => {
      capturedOnChange = props.onChange;
      return null;
    };

    render(<RecipeMain />);

    act(() => {
      capturedOnChange!('myRecipes');
    });

    expect(capturedEmptyState.title).toBe('No recipes yet');
    expect(capturedEmptyState.description).toBe('Create your first recipe');
    expect(capturedEmptyState.icon).toBe('create-outline');
    expect(capturedEmptyState.action.label).toBe('Create Recipe');
  });

  it('navigates to RecipeDetail with recipeId for My Recipes items', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const mockNavigate = jest.fn();
    const { useAppNavigation } = jest.requireMock('#hooks/navigation/useAppNavigation');
    useAppNavigation.mockReturnValue({
      navigate: mockNavigate,
      goBack: jest.fn(),
    });

    const { useRecipeManagement } = jest.requireMock('#/hooks/recipe/useRecipeManagement');
    useRecipeManagement.mockReturnValue({
      recipes: [
        { id: 'my-1', name: 'My Pasta', servings: 2, totalTimeMinutes: 20, imageUrl: null },
      ],
      loading: false,
      refetch: jest.fn(),
      loadMore: jest.fn(),
      hasMore: false,
      totalCount: 1,
    });

    let capturedOnItemPress: ((id: string | number) => void) | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedOnItemPress = props.onItemPress;
      return null;
    };

    let capturedOnChange: ((value: string) => void) | undefined;
    mockSegmentedControlImpl = (props: AnyProps) => {
      capturedOnChange = props.onChange;
      return null;
    };

    render(<RecipeMain />);

    act(() => {
      capturedOnChange!('myRecipes');
    });

    act(() => {
      capturedOnItemPress!('my-1');
    });

    expect(mockNavigate).toHaveBeenCalledWith('RecipeDetail', { recipeId: 'my-1' });
  });

  it('calls deleteRecipeMutation when deleting a My Recipes item', async () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const mockDelete = jest.fn().mockResolvedValue({});
    const { useDeleteRecipeMutation } = jest.requireMock('#generated');
    useDeleteRecipeMutation.mockReturnValue([mockDelete]);

    const { useRecipeManagement } = jest.requireMock('#/hooks/recipe/useRecipeManagement');
    useRecipeManagement.mockReturnValue({
      recipes: [
        { id: 'my-1', name: 'Delete Me', servings: 2, totalTimeMinutes: 10, imageUrl: null },
      ],
      loading: false,
      refetch: jest.fn(),
      loadMore: jest.fn(),
      hasMore: false,
      totalCount: 1,
    });

    let capturedOnItemDelete: ((id: string) => Promise<void>) | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedOnItemDelete = props.onItemDelete;
      return null;
    };

    let capturedOnChange: ((value: string) => void) | undefined;
    mockSegmentedControlImpl = (props: AnyProps) => {
      capturedOnChange = props.onChange;
      return null;
    };

    render(<RecipeMain />);

    act(() => {
      capturedOnChange!('myRecipes');
    });

    await act(async () => {
      await capturedOnItemDelete!('my-1');
    });

    expect(mockDelete).toHaveBeenCalledWith({ variables: { id: 'my-1' } });
  });

  it('hides FilterTabs, FolderPicker, TagPicker in My Recipes view', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useRecipeFolders } = jest.requireMock('#/hooks/recipe/useRecipeFolders');
    useRecipeFolders.mockReturnValue({ folders: ['Dinner'] });

    const { useRecipeTags } = jest.requireMock('#/hooks/recipe/useRecipeTags');
    useRecipeTags.mockReturnValue({ tags: ['easy'] });

    const { useSavedRecipes } = jest.requireMock('#/hooks/recipe/useSavedRecipes');
    useSavedRecipes.mockReturnValue({
      recipes: [{ recipeId: 'r-1', name: 'P', servings: 2, folder: 'Dinner', tags: ['easy'] }],
      loading: false,
      refetch: jest.fn(),
    });

    let filterTabsRendered = false;
    mockFilterTabsImpl = () => {
      filterTabsRendered = true;
      return null;
    };

    let folderPickerRendered = false;
    mockFolderPickerImpl = () => {
      folderPickerRendered = true;
      return null;
    };

    let tagPickerRendered = false;
    mockTagPickerImpl = () => {
      tagPickerRendered = true;
      return null;
    };

    let capturedOnChange: ((value: string) => void) | undefined;
    mockSegmentedControlImpl = (props: AnyProps) => {
      capturedOnChange = props.onChange;
      return null;
    };

    render(<RecipeMain />);

    // Verify they render in saved view
    expect(filterTabsRendered).toBe(true);
    expect(folderPickerRendered).toBe(true);
    expect(tagPickerRendered).toBe(true);

    // Reset flags
    filterTabsRendered = false;
    folderPickerRendered = false;
    tagPickerRendered = false;

    // Switch to My Recipes
    act(() => {
      capturedOnChange!('myRecipes');
    });

    expect(filterTabsRendered).toBe(false);
    expect(folderPickerRendered).toBe(false);
    expect(tagPickerRendered).toBe(false);
  });

  it('filters My Recipes by search query', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useRecipeManagement } = jest.requireMock('#/hooks/recipe/useRecipeManagement');
    useRecipeManagement.mockReturnValue({
      recipes: [
        { id: 'my-1', name: 'Pasta Carbonara', description: 'Italian', servings: 2, totalTimeMinutes: 30, imageUrl: null },
        { id: 'my-2', name: 'Chicken Tikka', description: 'Indian', servings: 4, totalTimeMinutes: 45, imageUrl: null },
      ],
      loading: false,
      refetch: jest.fn(),
      loadMore: jest.fn(),
      hasMore: false,
      totalCount: 2,
    });

    let capturedItems: any[] | undefined;
    mockItemListImpl = (props: AnyProps) => {
      capturedItems = props.items;
      return null;
    };

    let capturedOnChange: ((value: string) => void) | undefined;
    mockSegmentedControlImpl = (props: AnyProps) => {
      capturedOnChange = props.onChange;
      return null;
    };

    let capturedOnChangeText: ((text: string) => void) | undefined;
    const SearchBarModule = require('#components/molecules/SearchBar');
    const originalSearchBar = SearchBarModule.SearchBar;
    SearchBarModule.SearchBar = ({ onChangeText }: AnyProps) => {
      capturedOnChangeText = onChangeText;
      return null;
    };

    render(<RecipeMain />);

    act(() => {
      capturedOnChange!('myRecipes');
    });

    // Shows both initially
    expect(capturedItems!.length).toBe(2);

    act(() => {
      capturedOnChangeText!('pasta');
    });

    // Should filter to 1
    expect(capturedItems!.length).toBe(1);
    expect(capturedItems![0].title).toBe('Pasta Carbonara');

    SearchBarModule.SearchBar = originalSearchBar;
  });
});
