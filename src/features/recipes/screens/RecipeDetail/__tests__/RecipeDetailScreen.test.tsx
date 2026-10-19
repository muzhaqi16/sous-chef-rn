'use no memo';

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ModerationContentType } from '#/graphql/generated/schemaTypes';
import { useStore } from '#store';
import { RecipeDetail } from '../index';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { kitTestIDs } from '#components/testIDs';
import type { ReportContentSheet } from '#features/profile/ui/ReportContentSheet';
import { formatMonthDayYear } from '#/utils/formatters/date';

/** A header action, in the bar or in the "more" menu it overflowed into. */
const headerAction = (testID: string) => {
  const more = screen.queryByTestId(kitTestIDs.headerMoreButton);
  if (more) fireEvent.press(more);
  return screen.queryByTestId(testID);
};

/** Presses an overflowed action: its row runs once the menu has closed. */
const pressMenuAction = (testID: string) => {
  fireEvent.press(screen.getByTestId(kitTestIDs.headerMoreButton));
  fireEvent.press(screen.getByTestId(testID));
  const { onDismiss } = screen.UNSAFE_getByProps({ detached: true }).props as {
    onDismiss: () => void;
  };
  act(() => onDismiss());
};

// Capture's review banner has its own suite; this one renders without Apollo.
jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: () => false,
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual<object>('@react-navigation/native'),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  })),
  useRoute: jest.fn(() => ({
    params: {},
  })),
}));

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('#features/recipes/hooks/useRecipeDetail', () => ({
  useRecipeDetail: jest.fn(),
}));

jest.mock('#features/recipes/hooks/useRecipeFolders', () => ({
  useRecipeFolders: jest.fn(() => ({ folders: [] })),
}));

jest.mock('#features/recipes/hooks/useRecipeTags', () => ({
  useRecipeTags: jest.fn(() => ({ tags: [] })),
}));

jest.mock('#features/recipes/hooks/useRecipeReviews', () => ({
  useRecipeReviews: () => ({ state: {}, actions: {} }),
}));

jest.mock('#features/recipes/hooks/useForkRecipe', () => ({
  useForkRecipe: jest.fn(() => ({ forkRecipe: jest.fn(), forking: false })),
}));

jest.mock('#features/recipes/hooks/usePublishRecipe', () => ({
  usePublishRecipe: jest.fn(() => ({
    setSubmitted: jest.fn(),
    publishing: false,
  })),
}));

jest.mock('#components/providers/ScreenErrorBoundary', () => ({
  RecipeDetailErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock('#components/atoms/SousChefLoader', () => ({
  SousChefLoader: () => 'SousChefLoader',
}));

jest.mock('#features/recipes/components/FolderPicker', () => ({
  FolderPicker: () => null,
}));

// The picker pulls in gorhom's scrollable creator through the sheet shell,
// which this suite's mock set does not stand up.
jest.mock('#features/shoppingList/ui/ShoppingListPickerSheet', () => ({
  ShoppingListPickerSheet: () => null,
}));

jest.mock('#features/recipes/ui/MarkCookedModal', () => ({
  MarkCookedModal: () => null,
}));

jest.mock(
  '#features/recipes/components/modals/IngredientMatchingSheet',
  () => ({
    IngredientMatchingSheet: () => null,
  }),
);

jest.mock(
  '#features/recipes/components/modals/SaveRecipeSheet/SaveRecipeSheet',
  () => ({
    SaveRecipeSheet: () => null,
  }),
);

jest.mock(
  '#features/recipes/components/modals/ManageRecipeSheet/ManageRecipeSheet',
  () => ({
    ManageRecipeSheet: () => null,
  }),
);

jest.mock(
  '#features/mealPlan/components/AddToMealPlanSheet/AddToMealPlanSheet',
  () => ({
    AddToMealPlanSheet: () => null,
  }),
);

jest.mock('#features/recipes/components/ReviewSection', () => ({
  ReviewSection: () => null,
}));

// Stands in for the sheet, showing what the screen opened it with.
jest.mock('#features/profile/ui/ReportContentSheet', () => {
  const { Text } = require('#components/atoms/Text');
  const Probe: typeof ReportContentSheet = ({ visible, target }) =>
    visible ? (
      <Text testID="report-sheet">{JSON.stringify(target)}</Text>
    ) : null;
  return { ReportContentSheet: Probe };
});

jest.mock('#features/recipes/components/recipeDetail/IngredientCard', () => ({
  IngredientCard: () => null,
}));

jest.mock('react-native-turbo-image', () => 'TurboImage');

// The screen reads its params through `useRecipeDetail`, which is mocked here.
const route = { params: {} };

// The offline predicate `useOfflineAwareError` consults.
const mockApiUnavailable = jest.fn(() => false);
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: () => mockApiUnavailable(),
}));

/** Renders the screen over a `useRecipeDetail` holding no recipe and no error, but for `overrides`. */
function renderDetail(overrides: Record<string, unknown> = {}) {
  const { useRecipeDetail } = jest.requireMock<{ useRecipeDetail: jest.Mock }>(
    '#features/recipes/hooks/useRecipeDetail',
  );
  useRecipeDetail.mockReturnValue({
    goBack: jest.fn(),
    recipeId: null,
    catalogExternalId: undefined,
    loading: false,
    error: null,
    displayData: null,
    backendRecipe: null,
    saving: false,
    isSaved: false,
    handleSaveRecipe: jest.fn(),
    shoppingLists: [],
    addingToList: false,
    addedIngredients: new Set(),
    handleAddSingleIngredient: jest.fn(),
    handleAddAllIngredientsToList: jest.fn(),
    handleAddAllIngredients: jest.fn(),
    handleListSelected: jest.fn(),
    listPickerVisible: false,
    handleSheetDismiss: jest.fn(),
    cookedModalVisible: false,
    setCookedModalVisible: jest.fn(),
    markingAsCooked: false,
    handleMarkAsCooked: jest.fn(),
    handleSkipReview: jest.fn(),
    ingredientMatching: {
      isSheetVisible: false,
      editableMatches: [],
      matchSummary: null,
      updateMatch: jest.fn(),
      confirmConsumption: jest.fn(),
      confirmLoading: false,
      hasPantry: false,
      closeSheet: jest.fn(),
    },
    showFolderPicker: false,
    setShowFolderPicker: jest.fn(),
    updatingFolderTags: false,
    handleUpdateFolder: jest.fn(),
    handleUpdateTags: jest.fn(),
    handleUpdateNotes: jest.fn(),
    handleUpdateRating: jest.fn(),
    savedFolder: null,
    savedTags: [],
    savedNotes: null,
    savedRating: null,
    cookedCount: 0,
    handleUnfavoriteRecipe: jest.fn(),
    ...overrides,
  });
  return render(<RecipeDetail route={route} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApiUnavailable.mockReturnValue(false);
});

describe('RecipeDetail', () => {
  it('renders error state when error exists', () => {
    const tree = renderDetail({ error: 'Recipe not found' });
    expect(tree.getByText('Recipe not found')).toBeTruthy();
  });

  // A recipe never opened before has nothing cached to show offline; that is
  // not a failure, and the screen says so rather than "Couldn't load".
  it('shows the offline state for a recipe it has not downloaded', () => {
    mockApiUnavailable.mockReturnValue(true);
    const tree = renderDetail({
      recipeId: 'r-1',
      error: "Couldn't load this recipe",
    });

    expect(tree.getByTestId('state-offline')).toBeTruthy();
    expect(tree.queryByText("Couldn't load this recipe")).toBeNull();
  });

  it('renders loading state when loading', () => {
    const tree = renderDetail({
      loading: true,
    });
    // SousChefLoader is rendered during loading
    expect(tree.toJSON()).toBeTruthy();
  });

  it("renders recipe content, with its provider's notice", () => {
    const tree = renderDetail({
      displayData: {
        dataAttributions: [
          {
            source: 'SPOONACULAR',
            notice: 'Recipe data from Spoonacular.',
            licenseUrl: null,
            sourceUrl: 'https://spoonacular.com/recipes/carbonara-1',
          },
        ],
        details: 'complete',
        title: 'Spaghetti Carbonara',
        image: 'https://example.com/image.jpg',
        servings: 4,
        readyInMinutes: 25,
        summary: 'A classic Italian dish',
        ingredients: [
          { id: 'ing-1', name: 'Pasta', amount: 200, measures: {} },
        ],
        instructions: [],
        vegetarian: false,
        vegan: false,
        glutenFree: false,
        dairyFree: false,
      },
    });
    expect(tree.getAllByText('Spaghetti Carbonara')[0]).toBeTruthy();
    expect(tree.getByText('A classic Italian dish')).toBeTruthy();
    expect(tree.getByText('Recipe data from Spoonacular.')).toBeTruthy();
  });

  it('keeps a cached recipe on screen when the refresh fails', () => {
    const tree = renderDetail({
      // Offline, a cached recipe's refresh fails. Checking `error` before
      // `displayData` blanked the screen and called it "recipe not found".
      error: 'Network request failed',
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'Spaghetti Carbonara',
        image: 'https://example.com/image.jpg',
        servings: 4,
        readyInMinutes: 25,
        summary: 'A classic Italian dish',
        ingredients: [
          { id: 'ing-1', name: 'Pasta', amount: 200, measures: {} },
        ],
        instructions: [],
        vegetarian: false,
        vegan: false,
        glutenFree: false,
        dairyFree: false,
      },
    });
    expect(tree.getAllByText('Spaghetti Carbonara')[0]).toBeTruthy();
    expect(tree.getByText('A classic Italian dish')).toBeTruthy();
  });

  it('renders wrapped in error boundary', () => {
    const tree = renderDetail();
    expect(tree.toJSON()).toBeTruthy();
  });

  it('shows servings and time metadata', () => {
    const tree = renderDetail({
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'Quick Soup',
        servings: 6,
        readyInMinutes: 15,
        ingredients: [],
        instructions: [],
      },
    });
    expect(tree.getByText(/6 servings/)).toBeTruthy();
    expect(tree.getByText(/15 min/)).toBeTruthy();
  });

  // --- Branch coverage tests ---

  it('renders the hook error as the title', () => {
    const tree = renderDetail({
      recipeId: 'r1',
      error: "Couldn't load this recipe",
    });
    expect(tree.getByText("Couldn't load this recipe")).toBeTruthy();
  });

  it('renders "Recipe not found in database" when recipeId but no backendRecipe and no error', () => {
    const tree = renderDetail({
      recipeId: 'r1',
    });
    expect(tree.getByText('Recipe not found in database')).toBeTruthy();
  });

  it("renders the provider's dietary tags", () => {
    const tree = renderDetail({
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'Vegan Bowl',
        image: null,
        servings: 2,
        readyInMinutes: 15,
        healthScore: 85,
        summary: null,
        ingredients: [],
        instructions: [],
        vegetarian: true,
        vegan: true,
        glutenFree: true,
        dairyFree: true,
      },
    });
    expect(tree.getByText('Vegetarian')).toBeTruthy();
    expect(tree.getByText('Vegan')).toBeTruthy();
    expect(tree.getByText('Gluten Free')).toBeTruthy();
    expect(tree.getByText('Dairy Free')).toBeTruthy();
    expect(tree.getByText(/85% healthy/)).toBeTruthy();
  });

  it('renders saved recipe folder, tags, and notes for backend recipes', () => {
    const tree = renderDetail({
      recipeId: 'r1',
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'Saved Recipe',
        image: 'https://example.com/img.jpg',
        servings: 4,
        readyInMinutes: 30,
        ingredients: [],
        instructions: [],
      },
      backendRecipe: { createdBy: { id: 'user-1' } },
      isSaved: true,
      savedFolder: 'Dinner',
      savedTags: ['quick', 'easy'],
      savedNotes: 'My notes here',
      savedRating: 3,
      cookedCount: 5,
    });
    expect(tree.getByText('Dinner')).toBeTruthy();
    expect(tree.getByText('quick')).toBeTruthy();
    expect(tree.getByText('easy')).toBeTruthy();
    expect(tree.getByText('My notes here')).toBeTruthy();
    expect(tree.getByText('Rating')).toBeTruthy();
    expect(tree.getByText('Folder')).toBeTruthy();
    expect(tree.getByText('Tags')).toBeTruthy();
    expect(tree.getByText('Notes')).toBeTruthy();
    expect(tree.getByText('Cooked 5x')).toBeTruthy();
  });

  it('renders "Mark cooked" text when cookedCount is 0', () => {
    const tree = renderDetail({
      recipeId: 'r1',
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'A Recipe',
        image: null,
        servings: 2,
        ingredients: [],
        instructions: [],
      },
      backendRecipe: { createdBy: { id: 'other' } },
      isSaved: true,
    });
    expect(tree.getByText('Mark cooked')).toBeTruthy();
  });

  it('renders source attribution with sourceName', () => {
    const tree = renderDetail({
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'Test',
        image: null,
        servings: null,
        readyInMinutes: null,
        healthScore: null,
        ingredients: [],
        instructions: [],
        sourceName: 'AllRecipes',
        sourceUrl: 'https://allrecipes.com/r/1',
      },
    });
    expect(tree.getByText('Recipe from AllRecipes')).toBeTruthy();
    expect(tree.getByText('View Original Recipe')).toBeTruthy();
  });

  it('renders "Recipe not found" when no recipeId and no error', () => {
    const tree = renderDetail();
    expect(tree.getByText('Recipe not found')).toBeTruthy();
  });

  it('does not render image section when no image', () => {
    const tree = renderDetail({
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'No Image Recipe',
        image: null,
        servings: 2,
        ingredients: [],
        instructions: [],
      },
    });
    // Title is rendered but there's no BackButton in image container
    expect(tree.getAllByText('No Image Recipe')[0]).toBeTruthy();
  });

  it('renders "Adding..." when addingToList is true', () => {
    const tree = renderDetail({
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'Recipe',
        image: null,
        servings: 2,
        ingredients: [{ id: 'i1', name: 'Salt' }],
        instructions: [],
      },
      addingToList: true,
    });
    expect(tree.getByText('Adding...')).toBeTruthy();
  });

  it('renders "None" for folder when savedFolder is null', () => {
    const tree = renderDetail({
      recipeId: 'r1',
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'Recipe',
        image: null,
        servings: 2,
        ingredients: [],
        instructions: [],
      },
      backendRecipe: { createdBy: { id: 'other' } },
      isSaved: true,
    });
    expect(tree.getByText('None')).toBeTruthy();
  });

  it('renders with saving state', () => {
    const tree = renderDetail({
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'Saving Recipe',
        image: 'https://example.com/img.jpg',
        servings: 4,
        readyInMinutes: 20,
        ingredients: [{ id: 'i1', name: 'Salt' }],
        instructions: [{ number: 1, step: 'Add salt' }],
      },
      saving: true,
      shoppingLists: [{ id: 'sl-1', name: 'My List' }],
    });
    expect(tree.getAllByText('Saving Recipe')[0]).toBeTruthy();
  });

  it('renders with instructions present', () => {
    const tree = renderDetail({
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'With Instructions',
        image: null,
        servings: 2,
        readyInMinutes: 10,
        ingredients: [],
        instructions: [
          { number: 1, step: 'First step' },
          { number: 2, step: 'Second step' },
        ],
      },
    });
    expect(tree.getAllByText('With Instructions')[0]).toBeTruthy();
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders with added ingredients highlighted', () => {
    const tree = renderDetail({
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'Recipe With Ingredients',
        image: null,
        servings: 2,
        ingredients: [
          { id: 'i1', name: 'Flour', amount: 200, measures: {} },
          { id: 'i2', name: 'Sugar', amount: 100, measures: {} },
        ],
        instructions: [],
      },
      shoppingLists: [{ id: 'sl-1', name: 'Weekly' }],
      addedIngredients: new Set(['i1']),
    });
    expect(tree.getAllByText('Recipe With Ingredients')[0]).toBeTruthy();
  });

  it('renders marking as cooked state', () => {
    const tree = renderDetail({
      recipeId: 'r1',
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'Cooking Recipe',
        image: null,
        servings: 2,
        ingredients: [],
        instructions: [],
      },
      backendRecipe: { createdBy: { id: 'user-1' } },
      isSaved: true,
      cookedModalVisible: true,
      markingAsCooked: true,
      cookedCount: 2,
    });
    expect(tree.getAllByText('Cooking Recipe')[0]).toBeTruthy();
  });

  it('renders backend instructions with step/text format correctly', () => {
    const tree = renderDetail({
      recipeId: 'r1',
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'My Pasta Recipe',
        image: null,
        servings: 2,
        readyInMinutes: 30,
        ingredients: [],
        instructions: [
          { step: 1, text: 'Boil the water' },
          { step: 2, text: 'Cook the pasta' },
        ],
      },
      backendRecipe: { createdBy: { id: 'user-1' } },
    });
    expect(tree.getByText('Boil the water')).toBeTruthy();
    expect(tree.getByText('Cook the pasta')).toBeTruthy();
  });

  it('renders no-image header with back button when image is missing', () => {
    const tree = renderDetail({
      recipeId: 'r1',
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'No Image Recipe',
        image: null,
        servings: 2,
        ingredients: [],
        instructions: [],
      },
      backendRecipe: { createdBy: { id: 'user-1' } },
    });
    expect(tree.getAllByText('No Image Recipe')[0]).toBeTruthy();
    // No-image header renders with accessible meal plan button
    expect(tree.getByLabelText('Add to meal plan')).toBeTruthy();
  });

  it('does not show "0 min" when readyInMinutes is 0', () => {
    const tree = renderDetail({
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'Zero Time Recipe',
        image: null,
        servings: 2,
        readyInMinutes: 0,
        ingredients: [],
        instructions: [],
      },
    });
    expect(tree.getAllByText('Zero Time Recipe')[0]).toBeTruthy();
    expect(tree.queryByText(/0 min/)).toBeNull();
  });

  describe('a catalog recipe the API has not fully fetched', () => {
    const renderWithDetails = (details: string, { isSaved = false } = {}) =>
      renderDetail({
        recipeId: details === 'opening' ? null : 'catalog-1',
        isSaved,
        displayData: {
          dataAttributions: [],
          details,
          title: 'Spinach Strata',
          image: null,
          ingredients: [],
        },
        // A catalog recipe has no author.
        backendRecipe:
          details === 'opening' ? null : { id: 'catalog-1', createdBy: null },
      });

    it("shows the row's title while the API opens it", () => {
      const tree = renderWithDetails('opening');
      expect(tree.getAllByText('Spinach Strata')[0]).toBeTruthy();
      expect(tree.getByTestId('recipe-detail-skeleton')).toBeTruthy();
    });

    it('says a save will fetch its ingredients and steps', () => {
      const tree = renderWithDetails('pending');
      expect(tree.getByText("Details aren't here yet")).toBeTruthy();
      expect(
        tree.getByText(
          'Save it to have its ingredients and steps fetched, or pull down to try again.',
        ),
      ).toBeTruthy();
    });

    it('does not ask to save a recipe already saved', () => {
      const tree = renderWithDetails('pending', { isSaved: true });
      expect(
        tree.getByText(
          'Its ingredients and steps are on their way. Pull down to check.',
        ),
      ).toBeTruthy();
      expect(tree.queryByText(/^Save it/)).toBeNull();
    });

    it('says its source could not find it, without calling that final', () => {
      const tree = renderWithDetails('unavailable');
      expect(tree.getByText('Not available right now')).toBeTruthy();
    });

    it('offers no fork until its content is fetched', () => {
      renderWithDetails('pending');
      expect(headerAction(recipesTestIDs.forkButton)).toBeNull();
      renderWithDetails('unavailable');
      expect(headerAction(recipesTestIDs.forkButton)).toBeNull();
      renderWithDetails('complete');
      expect(headerAction(recipesTestIDs.forkButton)).toBeTruthy();
    });

    it('shows no notice once it is complete', () => {
      const tree = renderWithDetails('complete');
      expect(tree.queryByText("Details aren't here yet")).toBeNull();
      expect(tree.queryByText('Not available right now')).toBeNull();
    });
  });

  describe('when a saved recipe was last cooked', () => {
    const LAST_COOKED_AT = '2026-10-11T12:00:00.000Z';

    const renderSaved = (cooked: {
      cookedCount: number;
      lastCookedAt: string | null;
    }) =>
      renderDetail({
        recipeId: 'r1',
        isSaved: true,
        displayData: {
          dataAttributions: [],
          details: 'complete',
          title: 'Shakshuka',
          image: null,
          servings: 2,
          ingredients: [],
          instructions: [],
        },
        backendRecipe: { id: 'r1', createdBy: { id: 'other' } },
        ...cooked,
      });

    it('shows the date beside the cooked count', () => {
      const tree = renderSaved({
        cookedCount: 3,
        lastCookedAt: LAST_COOKED_AT,
      });

      expect(tree.getByText('Cooked 3x')).toBeTruthy();
      expect(
        tree.getByText(
          `Last cooked ${formatMonthDayYear(new Date(LAST_COOKED_AT))}`,
        ),
      ).toBeTruthy();
    });

    it('shows no date for a recipe never cooked', () => {
      const tree = renderSaved({ cookedCount: 0, lastCookedAt: null });

      expect(tree.getByText('Mark cooked')).toBeTruthy();
      expect(tree.queryByText(/Last cooked/)).toBeNull();
    });
  });
});

describe('reporting a recipe from its detail screen', () => {
  const VIEWER = {
    id: 'viewer',
    email: 'viewer@example.com',
    emailVerified: true,
    onBoarded: true,
    preferredCurrency: 'USD',
  };

  const renderRecipe = (createdBy: { id: string } | null) =>
    renderDetail({
      recipeId: 'recipe-1',
      displayData: {
        dataAttributions: [],
        details: 'complete',
        title: 'Spinach Strata',
        image: null,
        ingredients: [],
        instructions: [],
      },
      backendRecipe: { id: 'recipe-1', createdBy },
    });

  beforeEach(() => {
    useStore.setState({ user: VIEWER });
  });

  afterEach(() => {
    useStore.setState({ user: null });
  });

  it("opens the report for another user's recipe, naming it and its owner", () => {
    renderRecipe({ id: 'owner' });

    expect(screen.queryByTestId('report-sheet')).toBeNull();
    pressMenuAction(recipesTestIDs.reportButton);

    expect(screen.getByTestId('report-sheet')).toHaveTextContent(
      JSON.stringify({
        reportedUserId: 'owner',
        contentType: ModerationContentType.Recipe,
        contentId: 'recipe-1',
      }),
    );
  });

  it("offers no report on the viewer's own recipe", () => {
    renderRecipe({ id: VIEWER.id });

    expect(headerAction(recipesTestIDs.editButton)).toBeTruthy();
    expect(headerAction(recipesTestIDs.reportButton)).toBeNull();
  });

  it('offers no report on a catalog recipe, which nobody owns', () => {
    renderRecipe(null);

    expect(headerAction(recipesTestIDs.forkButton)).toBeTruthy();
    expect(headerAction(recipesTestIDs.reportButton)).toBeNull();
  });
});
