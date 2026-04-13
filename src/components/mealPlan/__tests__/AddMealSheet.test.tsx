'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AddMealSheet } from '../AddMealSheet';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
  })),
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: () => null,
}));

jest.mock('#components/molecules/BottomSheetSearchBar', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return {
    BottomSheetSearchBar: R.forwardRef((props: any, ref: any) => {
      R.useImperativeHandle(ref, () => ({
        clear: jest.fn(),
        focus: jest.fn(),
        blur: jest.fn(),
        getValue: jest.fn(() => ''),
        setValue: jest.fn(),
      }));
      return (
        <TextInput
          placeholder={props.placeholder}
          onChangeText={props.onChangeText}
          testID="search-bar"
        />
      );
    }),
  };
});

jest.mock('#hooks/recipe/useSavedRecipes', () => ({
  useSavedRecipes: jest.fn(() => ({
    state: {
      recipes: [
        {
          recipeId: 'r1',
          name: 'Pasta Carbonara',
          servings: 4,
          totalTimeMinutes: 30,
          imageUrl: null,
        },
        {
          recipeId: 'r2',
          name: 'Chicken Salad',
          servings: 2,
          totalTimeMinutes: 15,
          imageUrl: null,
        },
      ],
      hasMore: false,
    },
    actions: {
      loadMore: jest.fn(),
    },
  })),
}));

jest.mock('#hooks/recipe/useRecipePreload', () => ({
  useRecipePreload: jest.fn(() => ({
    preloadRecipe: jest.fn().mockResolvedValue({ id: 'preloaded-1' }),
  })),
}));

jest.mock('#services/recipeApi/SpoonacularService', () => ({
  spoonacularService: {
    searchRecipes: jest.fn().mockResolvedValue({ results: [] }),
    getRecipeInformation: jest.fn(),
  },
}));

jest.mock('#utils/recipeTransform', () => ({
  transformRecipeForDisplay: jest.fn((r: any) => r),
}));

jest.mock('#/services/toastService', () => ({
  toastService: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('#store/useRecipeCacheStore', () => ({
  useRecipeCacheStore: {
    getState: jest.fn(() => ({
      getCached: jest.fn(() => null),
      setCached: jest.fn(),
    })),
  },
  textSearchCacheKey: jest.fn((q: string) => `text:${q}`),
}));

jest.mock('#/utils/compilerSafeWrappers');

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  onAddRecipe: jest.fn(),
  onAddCustomMeal: jest.fn(),
};

describe('AddMealSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the header title', () => {
    render(<AddMealSheet {...defaultProps} />);
    expect(screen.getByText('Add a meal')).toBeTruthy();
  });

  it('renders all meal type chips', () => {
    render(<AddMealSheet {...defaultProps} />);
    expect(screen.getByText('Breakfast')).toBeTruthy();
    expect(screen.getByText('Lunch')).toBeTruthy();
    expect(screen.getByText('Dinner')).toBeTruthy();
    expect(screen.getByText('Snack')).toBeTruthy();
    expect(screen.getByText('Brunch')).toBeTruthy();
    expect(screen.getByText('Dessert')).toBeTruthy();
  });

  it('renders the search input with placeholder', () => {
    render(<AddMealSheet {...defaultProps} />);
    expect(
      screen.getByPlaceholderText('Search recipes or add a custom meal...'),
    ).toBeTruthy();
  });

  it('renders saved recipes', () => {
    render(<AddMealSheet {...defaultProps} />);
    expect(screen.getByText('Pasta Carbonara')).toBeTruthy();
    expect(screen.getByText('Chicken Salad')).toBeTruthy();
  });

  it('shows recipe metadata (servings and time)', () => {
    render(<AddMealSheet {...defaultProps} />);
    expect(screen.getByText(/4 servings/)).toBeTruthy();
  });

  it('renders recipe servings and time metadata', () => {
    render(<AddMealSheet {...defaultProps} />);
    expect(screen.getByText(/4 servings · 30 min/)).toBeTruthy();
    expect(screen.getByText(/2 servings · 15 min/)).toBeTruthy();
  });

  it('shows custom meal option when search query has text', () => {
    render(<AddMealSheet {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(
      'Search recipes or add a custom meal...',
    );
    fireEvent.changeText(searchInput, 'Tacos');
    expect(screen.getByText(/Add "Tacos" as custom meal/)).toBeTruthy();
  });

  it('shows "Your Recipes" section header when searching with results', () => {
    render(<AddMealSheet {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(
      'Search recipes or add a custom meal...',
    );
    fireEvent.changeText(searchInput, 'Pasta');
    expect(screen.getByText('Your Recipes')).toBeTruthy();
  });
});
