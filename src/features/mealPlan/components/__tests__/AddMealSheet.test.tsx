'use no memo';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AddMealSheet } from '../AddMealSheet';

jest.mock('#hooks/ui/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
  })),
  BottomSheetModal: ({ children }: { children?: React.ReactNode }) => children,
}));

jest.mock('#components/atoms/Icon', () => ({
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
        props: {
          placeholder?: string;
          onChangeText?: (text: string) => void;
          onSubmitEditing?: () => void;
          maxLength?: number;
        },
        ref: React.Ref<{
          clear: () => void;
          focus: () => void;
          blur: () => void;
          getValue: () => string;
          setValue: (value: string) => void;
        }>,
      ) => {
        const text = R.useRef('');
        R.useImperativeHandle(ref, () => ({
          clear: jest.fn(),
          focus: jest.fn(),
          blur: jest.fn(),
          getValue: () => text.current,
          setValue: jest.fn(),
        }));
        return (
          <TextInput
            placeholder={props.placeholder}
            onChangeText={(next: string) => {
              text.current = next;
              props.onChangeText?.(next);
            }}
            onSubmitEditing={props.onSubmitEditing}
            maxLength={props.maxLength}
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
      version: 1,
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
      version: 1,
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

jest.mock('#features/recipes/screens/useSavedRecipes', () => ({
  useSavedRecipes: jest.fn(),
}));

const savedRecipesResult = (pagesRemain: boolean) => ({
  state: {
    recipes: savedRecipeNodes,
    hasMore: pagesRemain,
    isLoadingRemainingPages: pagesRemain,
  },
  actions: { loadMore: jest.fn() },
});

// AddMealSheet's saved-recipe row uses `useFragment` for its per-entity cache
// subscription. The parent `useSavedRecipes` hook is mocked in this suite, but
// the row still needs an Apollo client to call `useFragment`. We wrap renders
// in a real Apollo provider with the saved-recipe nodes seeded into the cache,
// satisfying the row's lookup without coupling the test to operation names.
import {
  createApolloTestWrapper,
  recordMock,
  seedCache,
  type MockedResponse,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { Diet, ExternalSource } from '#/graphql/generated/schemaTypes';
import { OpenCatalogRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { SearchRecipesDocument } from '#features/recipes/hooks/useRecipeSearch.generated';
import type { FoundHit, FoundRecipe } from '#features/recipes/utils/recipeRows';

// One member type per response: the mock completion pins a list's union
// members by path, so a mixed list completes as one type.
const searchAnswering = (
  nodes: ReadonlyArray<FoundRecipe> | ReadonlyArray<FoundHit>,
) =>
  recordMock(SearchRecipesDocument, {
    data: {
      findRecipes: {
        edges: nodes.map(node => ({ node })),
        catalogAvailable: true,
      },
    },
  });

function renderWithApollo(
  ui: React.ReactElement,
  operationMocks: MockedResponse[] = [searchAnswering([]).mock],
) {
  const cache = seedCache(
    savedRecipeNodes.map(node => ({
      ...node,
      recipe: { ...node.recipe },
    })),
  );
  // Also seed the nested Recipe entries (seedCache doesn't recurse into
  // referenced entities).
  for (const node of savedRecipeNodes) {
    seedFragment(cache, {
      id: `Recipe:${node.recipe.id}`,
      fragment: require('../SavedRecipeRow.generated')
        .SavedRecipeRow_SavedRecipeFragmentDoc,
      fragmentName: 'SavedRecipeRow_savedRecipe',
      data: node,
    });
  }
  const Wrapper = createApolloTestWrapper({ cache, operationMocks });
  return render(<Wrapper>{ui}</Wrapper>);
}

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  onAddRecipe: jest.fn(),
  onAddCustomMeal: jest.fn(),
};

const searchField = () =>
  screen.getByPlaceholderText('Search recipes or add a custom meal...');

const typeAndSearch = (text: string) => {
  fireEvent.changeText(searchField(), text);
  fireEvent(searchField(), 'submitEditing');
};

const { useSavedRecipes: mockUseSavedRecipes } = jest.requireMock<{
  useSavedRecipes: jest.Mock;
}>('#features/recipes/screens/useSavedRecipes');

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AddMealSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSavedRecipes.mockImplementation(() => savedRecipesResult(false));
  });

  it('renders the header title', () => {
    renderWithApollo(<AddMealSheet {...defaultProps} />);
    expect(screen.getByText('Add a meal')).toBeTruthy();
  });

  it('stops the search at the longest query the API takes', () => {
    renderWithApollo(<AddMealSheet {...defaultProps} />);
    expect(screen.getByTestId('search-bar').props.maxLength).toBe(200);
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

  it('leaves an unpublished recipe out of the picker, searching included', () => {
    mockUseSavedRecipes.mockImplementation(() => ({
      ...savedRecipesResult(false),
      state: {
        ...savedRecipesResult(false).state,
        recipes: [
          ...savedRecipeNodes,
          { ...savedRecipeNodes[0], id: 'sr-gone', recipe: null },
        ],
      },
    }));
    renderWithApollo(<AddMealSheet {...defaultProps} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Search recipes or add a custom meal...'),
      'Pasta',
    );

    expect(screen.getByText('Pasta Carbonara')).toBeTruthy();
    expect(screen.queryByText('Chicken Salad')).toBeNull();
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

  it('asks for every saved-recipe page only while a search term is entered', () => {
    renderWithApollo(<AddMealSheet {...defaultProps} />);
    expect(mockUseSavedRecipes).toHaveBeenLastCalledWith({
      loadAllPages: false,
    });

    fireEvent.changeText(
      screen.getByPlaceholderText('Search recipes or add a custom meal...'),
      'la',
    );
    expect(mockUseSavedRecipes).toHaveBeenLastCalledWith({
      loadAllPages: true,
    });
  });

  it('shows the loading indicator, not "no results", while pages remain', () => {
    mockUseSavedRecipes.mockImplementation(() => savedRecipesResult(true));
    renderWithApollo(<AddMealSheet {...defaultProps} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Search recipes or add a custom meal...'),
      'zz',
    );

    expect(
      screen.getByText('Searching all your saved recipes...'),
    ).toBeTruthy();
    expect(screen.queryByText('No recipes match your search')).toBeNull();
  });

  it('shows the no-results message once the catalog search settles empty', async () => {
    renderWithApollo(<AddMealSheet {...defaultProps} />);
    fireEvent.changeText(searchField(), 'zzz');

    expect(screen.queryByText('Pasta Carbonara')).toBeNull();
    expect(screen.queryByText('Chicken Salad')).toBeNull();
    expect(screen.queryByText('No recipes match your search')).toBeNull();

    fireEvent.press(screen.getByText('Search all recipes for "zzz"'));

    await drainTimers();
    expect(screen.getByText('No recipes match your search')).toBeTruthy();
  });

  it('asks the catalog only when Search is pressed, never while typing', async () => {
    const search = searchAnswering([]);
    renderWithApollo(<AddMealSheet {...defaultProps} />, [search.mock]);

    for (const text of ['Lasa', 'Lasag', 'Lasagn', 'Lasagna']) {
      fireEvent.changeText(searchField(), text);
    }
    await drainTimers();
    expect(screen.getByText('Search all recipes for "Lasagna"')).toBeTruthy();
    expect(search.fired).toEqual([]);

    fireEvent(searchField(), 'submitEditing');

    await drainTimers();
    expect(search.fired).toHaveLength(1);
    expect(search.fired[0]).toEqual(
      expect.objectContaining({ query: 'Lasagna' }),
    );
    expect(screen.queryByText('Search all recipes for "Lasagna"')).toBeNull();
  });

  describe('a catalog result', () => {
    const lasagna: FoundHit = {
      __typename: 'CatalogRecipeHit',
      provider: ExternalSource.Spoonacular,
      providerRecipeId: '42',
      name: 'Lasagna',
      imageUrl: 'https://img.spoonacular.com/recipes/42-312x231.jpg',
      servings: 6,
      totalTimeMinutes: 45,
      diets: [],
      freeOf: [],
      likes: 3,
    };

    const pickLasagna = async (opened: MockedResponse) => {
      renderWithApollo(<AddMealSheet {...defaultProps} />, [
        searchAnswering([lasagna]).mock,
        opened,
      ]);
      typeAndSearch('Lasagna');
      await drainTimers();
      fireEvent.press(screen.getByText('Lasagna'));
    };

    it('is opened through the API by its provider and id, then planned', async () => {
      const open = recordMock(OpenCatalogRecipeDocument, {
        data: {
          upsertExternalRecipe: {
            __typename: 'UpsertExternalRecipePayload',
            recipe: { id: 'recipe-42' },
          },
        },
      });
      await pickLasagna(open.mock);

      await drainTimers();
      expect(defaultProps.onAddRecipe).toHaveBeenCalledWith(
        'recipe-42',
        expect.anything(),
      );
      expect(open.fired).toEqual([
        expect.objectContaining({
          input: {
            source: ExternalSource.Spoonacular,
            externalId: '42',
            name: 'Lasagna',
            imageUrl: lasagna.imageUrl,
          },
        }),
      ]);
    });

    it('stays open with the reason when the API cannot open it', async () => {
      const { toastService } = jest.requireMock<{
        toastService: { error: jest.Mock };
      }>('#/services/toastService');
      const gone = recordMock(OpenCatalogRecipeDocument, {
        data: { upsertExternalRecipe: { __typename: 'NotFoundError' } },
      });
      await pickLasagna(gone.mock);

      await drainTimers();
      expect(toastService.error).toHaveBeenCalledWith('Recipe not found');
      expect(defaultProps.onAddRecipe).not.toHaveBeenCalled();
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('a recipe the API holds', () => {
    const held = (id: string, name: string): FoundRecipe => ({
      __typename: 'Recipe',
      version: 1,
      id,
      name,
      imageUrl: null,
      servings: 4,
      totalTimeMinutes: 20,
      diets: [Diet.Vegetarian],
      freeOf: [],
      isSaved: false,
    });

    it('is planned by its id, with no open', async () => {
      const open = recordMock(OpenCatalogRecipeDocument);
      renderWithApollo(<AddMealSheet {...defaultProps} />, [
        searchAnswering([held('r9', 'Beef Stew')]).mock,
        open.mock,
      ]);
      typeAndSearch('Stew');
      await drainTimers();
      fireEvent.press(screen.getByText('Beef Stew'));

      expect(defaultProps.onAddRecipe).toHaveBeenCalledWith(
        'r9',
        expect.anything(),
      );
      expect(open.fired).toEqual([]);
    });

    it('is listed once when it is also saved', async () => {
      renderWithApollo(<AddMealSheet {...defaultProps} />, [
        searchAnswering([
          held('r1', 'Pasta Carbonara'),
          held('r10', 'Pasta Bake'),
        ]).mock,
      ]);
      typeAndSearch('Pasta');

      await drainTimers();
      expect(screen.getByText('Pasta Bake')).toBeTruthy();
      expect(screen.getAllByText('Pasta Carbonara')).toHaveLength(1);
    });

    it('is listed once when it is saved but its name does not hold the search', async () => {
      renderWithApollo(<AddMealSheet {...defaultProps} />, [
        searchAnswering([held('r2', 'Chicken Salad')]).mock,
      ]);
      typeAndSearch('chiken');

      await drainTimers();
      expect(screen.getByText('Chicken Salad')).toBeTruthy();
      expect(screen.getAllByText('Chicken Salad')).toHaveLength(1);
    });
  });
});
