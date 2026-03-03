'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { RecipeSearch } from '../index';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('../useRecipeSearch', () => ({
  useRecipeSearch: jest.fn(() => ({
    goBack: jest.fn(),
    searchQuery: '',
    setSearchQuery: jest.fn(),
    loading: false,
    searchPerformed: false,
    selectedIngredients: new Set(),
    activeFilters: {
      diet: null,
      intolerances: [],
      mealType: null,
      maxReadyTime: null,
    },
    setActiveFilters: jest.fn(),
    ingredientSheetRef: { current: null },
    filterSheetRef: { current: null },
    pantryItems: [
      { id: '1', itemName: 'Chicken' },
      { id: '2', itemName: 'Rice' },
    ],
    hasPantryItems: true,
    handleTextSearch: jest.fn(),
    handleIngredientSearch: jest.fn(),
    openIngredientSelector: jest.fn(),
    toggleIngredient: jest.fn(),
    openFilterSheet: jest.fn(),
    clearFilters: jest.fn(),
    applyFilters: jest.fn(),
    activeFilterCount: 0,
    items: [],
    handleItemPress: jest.fn(),
  })),
}));

jest.mock('#components/templates/ListTemplate', () => ({
  ListTemplate: () => null,
}));

jest.mock('#components/molecules/SearchBar', () => ({
  SearchBar: () => 'SearchBar',
}));

jest.mock('#components/molecules/Header', () => ({
  Header: ({ title }: any) => title,
}));

jest.mock('#components/templates/BottomSheetAction', () => ({
  BottomSheetAction: () => null,
}));

jest.mock('#components/organisms/ItemList', () => ({
  ItemList: () => null,
}));

jest.mock('#components/base/Skeleton/RecipeCardSkeleton', () => ({
  RecipeCardSkeleton: () => 'RecipeCardSkeleton',
}));

jest.mock('#components/atoms/OfflineGate', () => ({
  OfflineGate: ({ children }: any) => children,
}));

jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: 'CachedImage',
}));

jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {},
}));

describe('RecipeSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the recipe search screen', () => {
    const { getByTestId } = render(<RecipeSearch />);
    expect(getByTestId('recipe-search-screen')).toBeTruthy();
  });

  it('renders when loading with search performed', () => {
    const { useRecipeSearch } = jest.requireMock('../useRecipeSearch');
    useRecipeSearch.mockReturnValue({
      goBack: jest.fn(),
      searchQuery: 'pasta',
      setSearchQuery: jest.fn(),
      loading: true,
      searchPerformed: true,
      selectedIngredients: new Set(),
      activeFilters: { diet: null, intolerances: [], mealType: null, maxReadyTime: null },
      setActiveFilters: jest.fn(),
      ingredientSheetRef: { current: null },
      filterSheetRef: { current: null },
      pantryItems: [],
      hasPantryItems: false,
      handleTextSearch: jest.fn(),
      handleIngredientSearch: jest.fn(),
      openIngredientSelector: jest.fn(),
      toggleIngredient: jest.fn(),
      openFilterSheet: jest.fn(),
      clearFilters: jest.fn(),
      applyFilters: jest.fn(),
      activeFilterCount: 0,
      items: [],
      handleItemPress: jest.fn(),
    });

    const { getByTestId } = render(<RecipeSearch />);
    expect(getByTestId('recipe-search-screen')).toBeTruthy();
  });

  it('renders with search results', () => {
    const { useRecipeSearch } = jest.requireMock('../useRecipeSearch');
    useRecipeSearch.mockReturnValue({
      goBack: jest.fn(),
      searchQuery: 'chicken',
      setSearchQuery: jest.fn(),
      loading: false,
      searchPerformed: true,
      selectedIngredients: new Set(),
      activeFilters: { diet: null, intolerances: [], mealType: null, maxReadyTime: null },
      setActiveFilters: jest.fn(),
      ingredientSheetRef: { current: null },
      filterSheetRef: { current: null },
      pantryItems: [],
      hasPantryItems: false,
      handleTextSearch: jest.fn(),
      handleIngredientSearch: jest.fn(),
      openIngredientSelector: jest.fn(),
      toggleIngredient: jest.fn(),
      openFilterSheet: jest.fn(),
      clearFilters: jest.fn(),
      applyFilters: jest.fn(),
      activeFilterCount: 0,
      items: [
        { id: '1', title: 'Chicken Curry', imageUrl: 'https://example.com/img.jpg' },
        { id: '2', title: 'Chicken Soup', imageUrl: null },
      ],
      handleItemPress: jest.fn(),
    });

    const { getByTestId } = render(<RecipeSearch />);
    expect(getByTestId('recipe-search-screen')).toBeTruthy();
  });

  it('renders with active filters', () => {
    const { useRecipeSearch } = jest.requireMock('../useRecipeSearch');
    useRecipeSearch.mockReturnValue({
      goBack: jest.fn(),
      searchQuery: '',
      setSearchQuery: jest.fn(),
      loading: false,
      searchPerformed: false,
      selectedIngredients: new Set(['Chicken']),
      activeFilters: { diet: 'vegan', intolerances: ['gluten'], mealType: 'dinner', maxReadyTime: 30 },
      setActiveFilters: jest.fn(),
      ingredientSheetRef: { current: null },
      filterSheetRef: { current: null },
      pantryItems: [{ id: '1', itemName: 'Chicken' }],
      hasPantryItems: true,
      handleTextSearch: jest.fn(),
      handleIngredientSearch: jest.fn(),
      openIngredientSelector: jest.fn(),
      toggleIngredient: jest.fn(),
      openFilterSheet: jest.fn(),
      clearFilters: jest.fn(),
      applyFilters: jest.fn(),
      activeFilterCount: 4,
      items: [],
      handleItemPress: jest.fn(),
    });

    const { getByTestId } = render(<RecipeSearch />);
    expect(getByTestId('recipe-search-screen')).toBeTruthy();
  });

  it('renders without pantry items', () => {
    const { useRecipeSearch } = jest.requireMock('../useRecipeSearch');
    useRecipeSearch.mockReturnValue({
      goBack: jest.fn(),
      searchQuery: '',
      setSearchQuery: jest.fn(),
      loading: false,
      searchPerformed: false,
      selectedIngredients: new Set(),
      activeFilters: { diet: null, intolerances: [], mealType: null, maxReadyTime: null },
      setActiveFilters: jest.fn(),
      ingredientSheetRef: { current: null },
      filterSheetRef: { current: null },
      pantryItems: [],
      hasPantryItems: false,
      handleTextSearch: jest.fn(),
      handleIngredientSearch: jest.fn(),
      openIngredientSelector: jest.fn(),
      toggleIngredient: jest.fn(),
      openFilterSheet: jest.fn(),
      clearFilters: jest.fn(),
      applyFilters: jest.fn(),
      activeFilterCount: 0,
      items: [],
      handleItemPress: jest.fn(),
    });

    const { getByTestId } = render(<RecipeSearch />);
    expect(getByTestId('recipe-search-screen')).toBeTruthy();
  });

  it('renders empty state after search with no results', () => {
    const { useRecipeSearch } = jest.requireMock('../useRecipeSearch');
    useRecipeSearch.mockReturnValue({
      goBack: jest.fn(),
      searchQuery: 'nonexistent dish',
      setSearchQuery: jest.fn(),
      loading: false,
      searchPerformed: true,
      selectedIngredients: new Set(),
      activeFilters: { diet: null, intolerances: [], mealType: null, maxReadyTime: null },
      setActiveFilters: jest.fn(),
      ingredientSheetRef: { current: null },
      filterSheetRef: { current: null },
      pantryItems: [],
      hasPantryItems: false,
      handleTextSearch: jest.fn(),
      handleIngredientSearch: jest.fn(),
      openIngredientSelector: jest.fn(),
      toggleIngredient: jest.fn(),
      openFilterSheet: jest.fn(),
      clearFilters: jest.fn(),
      applyFilters: jest.fn(),
      activeFilterCount: 0,
      items: [],
      handleItemPress: jest.fn(),
    });

    const { getByTestId } = render(<RecipeSearch />);
    expect(getByTestId('recipe-search-screen')).toBeTruthy();
  });

  it('renders with multiple selected ingredients', () => {
    const { useRecipeSearch } = jest.requireMock('../useRecipeSearch');
    useRecipeSearch.mockReturnValue({
      goBack: jest.fn(),
      searchQuery: '',
      setSearchQuery: jest.fn(),
      loading: false,
      searchPerformed: false,
      selectedIngredients: new Set(['Chicken', 'Rice', 'Broccoli']),
      activeFilters: { diet: null, intolerances: [], mealType: null, maxReadyTime: null },
      setActiveFilters: jest.fn(),
      ingredientSheetRef: { current: null },
      filterSheetRef: { current: null },
      pantryItems: [
        { id: '1', itemName: 'Chicken' },
        { id: '2', itemName: 'Rice' },
        { id: '3', itemName: 'Broccoli' },
      ],
      hasPantryItems: true,
      handleTextSearch: jest.fn(),
      handleIngredientSearch: jest.fn(),
      openIngredientSelector: jest.fn(),
      toggleIngredient: jest.fn(),
      openFilterSheet: jest.fn(),
      clearFilters: jest.fn(),
      applyFilters: jest.fn(),
      activeFilterCount: 0,
      items: [],
      handleItemPress: jest.fn(),
    });

    const { getByTestId } = render(<RecipeSearch />);
    expect(getByTestId('recipe-search-screen')).toBeTruthy();
  });

  it('renders with partial filters set', () => {
    const { useRecipeSearch } = jest.requireMock('../useRecipeSearch');
    useRecipeSearch.mockReturnValue({
      goBack: jest.fn(),
      searchQuery: 'soup',
      setSearchQuery: jest.fn(),
      loading: false,
      searchPerformed: true,
      selectedIngredients: new Set(),
      activeFilters: { diet: 'vegetarian', intolerances: [], mealType: null, maxReadyTime: 45 },
      setActiveFilters: jest.fn(),
      ingredientSheetRef: { current: null },
      filterSheetRef: { current: null },
      pantryItems: [],
      hasPantryItems: false,
      handleTextSearch: jest.fn(),
      handleIngredientSearch: jest.fn(),
      openIngredientSelector: jest.fn(),
      toggleIngredient: jest.fn(),
      openFilterSheet: jest.fn(),
      clearFilters: jest.fn(),
      applyFilters: jest.fn(),
      activeFilterCount: 2,
      items: [
        { id: '1', title: 'Vegetable Soup', imageUrl: null },
      ],
      handleItemPress: jest.fn(),
    });

    const { getByTestId } = render(<RecipeSearch />);
    expect(getByTestId('recipe-search-screen')).toBeTruthy();
  });

  it('renders while loading without search performed', () => {
    const { useRecipeSearch } = jest.requireMock('../useRecipeSearch');
    useRecipeSearch.mockReturnValue({
      goBack: jest.fn(),
      searchQuery: '',
      setSearchQuery: jest.fn(),
      loading: true,
      searchPerformed: false,
      selectedIngredients: new Set(),
      activeFilters: { diet: null, intolerances: [], mealType: null, maxReadyTime: null },
      setActiveFilters: jest.fn(),
      ingredientSheetRef: { current: null },
      filterSheetRef: { current: null },
      pantryItems: [],
      hasPantryItems: false,
      handleTextSearch: jest.fn(),
      handleIngredientSearch: jest.fn(),
      openIngredientSelector: jest.fn(),
      toggleIngredient: jest.fn(),
      openFilterSheet: jest.fn(),
      clearFilters: jest.fn(),
      applyFilters: jest.fn(),
      activeFilterCount: 0,
      items: [],
      handleItemPress: jest.fn(),
    });

    const { getByTestId } = render(<RecipeSearch />);
    expect(getByTestId('recipe-search-screen')).toBeTruthy();
  });

  it('renders with many search results', () => {
    const { useRecipeSearch } = jest.requireMock('../useRecipeSearch');
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      title: `Recipe ${i}`,
      imageUrl: i % 2 === 0 ? `https://example.com/${i}.jpg` : null,
    }));
    useRecipeSearch.mockReturnValue({
      goBack: jest.fn(),
      searchQuery: 'pasta',
      setSearchQuery: jest.fn(),
      loading: false,
      searchPerformed: true,
      selectedIngredients: new Set(),
      activeFilters: { diet: null, intolerances: [], mealType: 'dinner', maxReadyTime: null },
      setActiveFilters: jest.fn(),
      ingredientSheetRef: { current: null },
      filterSheetRef: { current: null },
      pantryItems: [],
      hasPantryItems: false,
      handleTextSearch: jest.fn(),
      handleIngredientSearch: jest.fn(),
      openIngredientSelector: jest.fn(),
      toggleIngredient: jest.fn(),
      openFilterSheet: jest.fn(),
      clearFilters: jest.fn(),
      applyFilters: jest.fn(),
      activeFilterCount: 1,
      items,
      handleItemPress: jest.fn(),
    });

    const { getByTestId } = render(<RecipeSearch />);
    expect(getByTestId('recipe-search-screen')).toBeTruthy();
  });
});
