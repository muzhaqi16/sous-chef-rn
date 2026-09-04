'use no memo';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AddMealSheet } from '../AddMealSheet';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
  })),
  BottomSheetModal: ({ children }: { children?: React.ReactNode }) => children,
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: () => null,
}));

jest.mock('#components/molecules/SearchBar', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return {
    SearchBar: R.forwardRef(
      (
        props: { placeholder?: string; onChangeText?: (text: string) => void },
        ref: React.Ref<{
          clear: () => void;
          focus: () => void;
          blur: () => void;
          getValue: () => string;
          setValue: (value: string) => void;
        }>,
      ) => {
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
      },
    ),
  };
});

// The hook now returns connection node refs; the rendered row internally calls
// `useFragment` to read the saved-recipe shape. We mock both so the component
// renders without an Apollo provider.
const savedRecipeNodes = [
  {
    __typename: 'SavedRecipe',
    id: 'sr-1',
    folder: null,
    tags: [],
    notes: null,
    personalRating: null,
    cookedCount: 0,
    lastCookedAt: null,
    recipe: {
      __typename: 'Recipe',
      id: 'r1',
      name: 'Pasta Carbonara',
      description: null,
      imageUrl: null,
      servings: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      totalTimeMinutes: 30,
    },
  },
  {
    __typename: 'SavedRecipe',
    id: 'sr-2',
    folder: null,
    tags: [],
    notes: null,
    personalRating: null,
    cookedCount: 0,
    lastCookedAt: null,
    recipe: {
      __typename: 'Recipe',
      id: 'r2',
      name: 'Chicken Salad',
      description: null,
      imageUrl: null,
      servings: 2,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      totalTimeMinutes: 15,
    },
  },
];

jest.mock('#features/recipes/hooks/useSavedRecipes', () => ({
  useSavedRecipes: jest.fn(() => ({
    state: {
      recipes: savedRecipeNodes,
      hasMore: false,
    },
    actions: {
      loadMore: jest.fn(),
    },
  })),
}));

// AddMealSheet's saved-recipe row uses `useFragment` for its per-entity cache
// subscription. The parent `useSavedRecipes` hook is mocked in this suite, but
// the row still needs an Apollo client to call `useFragment`. We wrap renders
// in a real Apollo provider with the saved-recipe nodes seeded into the cache,
// satisfying the row's lookup without coupling the test to operation names.
import {
  createApolloTestWrapper,
  seedCache,
} from '#/test-utils/apolloMockProvider';

function renderWithApollo(ui: React.ReactElement) {
  const cache = seedCache(
    savedRecipeNodes.map(node => ({
      ...node,
      recipe: { ...node.recipe },
    })),
  );
  // Also seed the nested Recipe entries (seedCache doesn't recurse into
  // referenced entities).
  for (const node of savedRecipeNodes) {
    cache.writeFragment({
      id: `Recipe:${node.recipe.id}`,
      fragment: require('../AddMealSheet.generated')
        .AddMealSheet_SavedRecipeFragmentDoc,
      fragmentName: 'AddMealSheet_savedRecipe',
      data: node,
    });
  }
  const Wrapper = createApolloTestWrapper({ cache });
  return render(<Wrapper>{ui}</Wrapper>);
}

jest.mock('#features/recipes/hooks/useRecipePreload', () => ({
  useRecipePreload: jest.fn(() => ({
    preloadRecipe: jest.fn().mockResolvedValue({ id: 'preloaded-1' }),
  })),
}));

jest.mock('#/services/spoonacular/SpoonacularService', () => ({
  spoonacularService: {
    searchRecipes: jest.fn().mockResolvedValue({ results: [] }),
    getRecipeInformation: jest.fn(),
  },
}));

jest.mock('#domain/recipeTransform', () => ({
  transformRecipeForDisplay: jest.fn((r: unknown) => r),
}));

jest.mock('#/services/toastService', () => ({
  toastService: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('#features/recipes/store/useRecipeCacheStore', () => ({
  useRecipeCacheStore: {
    getState: jest.fn(() => ({
      getCached: jest.fn(() => null),
      setCached: jest.fn(),
    })),
  },
  textSearchCacheKey: jest.fn((q: string) => `text:${q}`),
}));

jest.mock('#/utils/finallyHelpers');

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
    renderWithApollo(<AddMealSheet {...defaultProps} />);
    expect(screen.getByText('Add a meal')).toBeTruthy();
  });

  it('renders all meal type chips', () => {
    renderWithApollo(<AddMealSheet {...defaultProps} />);
    expect(screen.getByText('Breakfast')).toBeTruthy();
    expect(screen.getByText('Lunch')).toBeTruthy();
    expect(screen.getByText('Dinner')).toBeTruthy();
    expect(screen.getByText('Snack')).toBeTruthy();
    expect(screen.getByText('Brunch')).toBeTruthy();
    expect(screen.getByText('Dessert')).toBeTruthy();
  });

  it('renders the search input with placeholder', () => {
    renderWithApollo(<AddMealSheet {...defaultProps} />);
    expect(
      screen.getByPlaceholderText('Search recipes or add a custom meal...'),
    ).toBeTruthy();
  });

  it('renders saved recipes', () => {
    renderWithApollo(<AddMealSheet {...defaultProps} />);
    expect(screen.getByText('Pasta Carbonara')).toBeTruthy();
    expect(screen.getByText('Chicken Salad')).toBeTruthy();
  });

  it('shows recipe metadata (servings and time)', () => {
    renderWithApollo(<AddMealSheet {...defaultProps} />);
    expect(screen.getByText(/4 servings/)).toBeTruthy();
  });

  it('renders recipe servings and time metadata', () => {
    renderWithApollo(<AddMealSheet {...defaultProps} />);
    expect(screen.getByText(/4 servings · 30 min/)).toBeTruthy();
    expect(screen.getByText(/2 servings · 15 min/)).toBeTruthy();
  });

  it('shows custom meal option when search query has text', () => {
    renderWithApollo(<AddMealSheet {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(
      'Search recipes or add a custom meal...',
    );
    fireEvent.changeText(searchInput, 'Tacos');
    expect(screen.getByText(/Add "Tacos" as custom meal/)).toBeTruthy();
  });

  it('keeps "Your Recipes" section header while searching with matches', () => {
    renderWithApollo(<AddMealSheet {...defaultProps} />);
    expect(screen.getByText('Your Recipes')).toBeTruthy();
    const searchInput = screen.getByPlaceholderText(
      'Search recipes or add a custom meal...',
    );
    fireEvent.changeText(searchInput, 'Pasta');
    // The header labels the saved-recipe matches, separating them from the
    // API results rendered below.
    expect(screen.getByText('Your Recipes')).toBeTruthy();
  });

  it('drops "Your Recipes" section header when no saved recipe matches', () => {
    renderWithApollo(<AddMealSheet {...defaultProps} />);
    expect(screen.getByText('Your Recipes')).toBeTruthy();
    const searchInput = screen.getByPlaceholderText(
      'Search recipes or add a custom meal...',
    );
    fireEvent.changeText(searchInput, 'zzz');
    expect(screen.queryByText('Your Recipes')).toBeNull();
  });

  it('narrows the saved-recipe rows to search matches', () => {
    renderWithApollo(<AddMealSheet {...defaultProps} />);
    expect(screen.getByText('Pasta Carbonara')).toBeTruthy();
    expect(screen.getByText('Chicken Salad')).toBeTruthy();

    const searchInput = screen.getByPlaceholderText(
      'Search recipes or add a custom meal...',
    );
    fireEvent.changeText(searchInput, 'pasta');

    // Matching is case-insensitive and drops non-matching rows from the list
    // itself, rather than rendering them as empty cells.
    expect(screen.getByText('Pasta Carbonara')).toBeTruthy();
    expect(screen.queryByText('Chicken Salad')).toBeNull();
  });

  it('shows the no-results message when the query matches no saved recipe', async () => {
    renderWithApollo(<AddMealSheet {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(
      'Search recipes or add a custom meal...',
    );
    fireEvent.changeText(searchInput, 'zzz');

    expect(screen.queryByText('Pasta Carbonara')).toBeNull();
    expect(screen.queryByText('Chicken Salad')).toBeNull();
    // The query is long enough to trigger the API search, so the message only
    // appears once that settles empty and the spinner clears.
    expect(
      await screen.findByText('No recipes match your search'),
    ).toBeTruthy();
  });
});
