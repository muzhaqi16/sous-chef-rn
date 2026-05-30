'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { RecipeDetail } from '../index';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('@react-navigation/native', () => ({
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

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'user-1' },
  })),
}));

// Mock the hook fully
jest.mock('../../../hooks/useRecipeDetail', () => ({
  useRecipeDetail: jest.fn(() => ({
    goBack: jest.fn(),
    recipeId: null,
    externalId: '123',
    loading: false,
    error: 'Recipe not found',
    backendError: null,
    displayData: null,
    isBackendRecipe: false,
    backendRecipe: null,
    saving: false,
    isSaved: false,
    handleSaveRecipe: jest.fn(),
    shoppingLists: [],
    addingToList: false,
    addedIngredients: new Set(),
    selectedIngredients: new Set(),
    handleAddSingleIngredient: jest.fn(),
    handleAddAllIngredientsToList: jest.fn(),
    handleAddAllIngredients: jest.fn(),
    handleAddSelectedIngredients: jest.fn(),
    handleListSelected: jest.fn(),
    toggleIngredient: jest.fn(),
    openIngredientSelector: jest.fn(),
    shoppingListOptionsRef: { current: null },
    ingredientSelectorRef: { current: null },
    listPickerRef: { current: null },
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
    preloading: false,
    preloadedRecipe: null,
  })),
}));

jest.mock('#features/recipes/hooks/useRecipeFolders', () => ({
  useRecipeFolders: jest.fn(() => ({ folders: [] })),
}));

jest.mock('#features/recipes/hooks/useRecipeTags', () => ({
  useRecipeTags: jest.fn(() => ({ tags: [] })),
}));

jest.mock('#features/recipes/hooks/useRecipeReviews', () => ({
  useRecipeReviews: jest.fn(() => ({
    reviews: [],
    loading: false,
  })),
}));

jest.mock('#/components/providers/ScreenErrorBoundary', () => ({
  RecipeDetailErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock('#/components/base/SousChefLoader', () => ({
  SousChefLoader: () => 'SousChefLoader',
}));

jest.mock('#components/atoms/BackButton', () => ({
  BackButton: () => 'BackButton',
}));

jest.mock('#components/templates/BottomSheetAction', () => ({
  BottomSheetAction: () => null,
}));

jest.mock('#components/molecules/FolderPicker', () => ({
  FolderPicker: () => null,
}));

jest.mock('#/components/modals/MarkCookedModal', () => ({
  MarkCookedModal: () => null,
}));

jest.mock('#/components/modals/IngredientMatchingSheet', () => ({
  IngredientMatchingSheet: () => null,
}));

jest.mock('#/components/modals/SaveRecipeSheet/SaveRecipeSheet', () => ({
  SaveRecipeSheet: () => null,
}));

jest.mock('#/components/modals/ManageRecipeSheet/ManageRecipeSheet', () => ({
  ManageRecipeSheet: () => null,
}));

jest.mock('#components/modals/AddToMealPlanSheet/AddToMealPlanSheet', () => ({
  AddToMealPlanSheet: () => null,
}));

jest.mock('#features/recipes/components/ReviewSection', () => ({
  ReviewSection: () => null,
}));

jest.mock('../components/IngredientCard', () => ({
  IngredientCard: () => null,
}));

jest.mock('react-native-turbo-image', () => 'TurboImage');

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetFlatList: () => null,
  BottomSheetTextInput: () => null,
  BottomSheetModal: 'BottomSheetModal',
  useBottomSheetScrollableCreator: jest.fn(() => () => null),
}));

describe('RecipeDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders error state when error exists', () => {
    const tree = render(<RecipeDetail />);
    expect(tree.getByText('Recipe not found')).toBeTruthy();
  });

  it('renders loading state when loading', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: null,
      externalId: '123',
      loading: true,
      error: null,
      backendError: null,
      displayData: null,
      isBackendRecipe: false,
      backendRecipe: null,
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    // SousChefLoader is rendered during loading
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders recipe content when displayData exists', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: null,
      externalId: '123',
      loading: false,
      error: null,
      backendError: null,
      displayData: {
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
      isBackendRecipe: false,
      backendRecipe: null,
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('Spaghetti Carbonara')).toBeTruthy();
    expect(tree.getByText('A classic Italian dish')).toBeTruthy();
  });

  it('renders wrapped in error boundary', () => {
    const tree = render(<RecipeDetail />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('shows servings and time metadata', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: null,
      externalId: null,
      loading: false,
      error: null,
      backendError: null,
      displayData: {
        title: 'Quick Soup',
        servings: 6,
        readyInMinutes: 15,
        ingredients: [],
        instructions: [],
      },
      isBackendRecipe: false,
      backendRecipe: null,
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText(/6 servings/)).toBeTruthy();
    expect(tree.getByText(/15 min/)).toBeTruthy();
  });

  // --- Branch coverage tests ---

  it('renders backendError details when backendError exists', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: 'r1',
      externalId: null,
      loading: false,
      error: null,
      backendError: { message: 'Network error' },
      displayData: null,
      isBackendRecipe: false,
      backendRecipe: null,
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('Network error')).toBeTruthy();
  });

  it('renders "Recipe not found in database" when recipeId but no backendRecipe and no error', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: 'r1',
      externalId: null,
      loading: false,
      error: null,
      backendError: null,
      displayData: null,
      isBackendRecipe: false,
      backendRecipe: null,
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('Recipe not found in database')).toBeTruthy();
  });

  it('renders dietary tags for external recipes', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: null,
      externalId: '123',
      loading: false,
      error: null,
      backendError: null,
      displayData: {
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
      isBackendRecipe: false,
      backendRecipe: null,
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('Vegetarian')).toBeTruthy();
    expect(tree.getByText('Vegan')).toBeTruthy();
    expect(tree.getByText('Gluten Free')).toBeTruthy();
    expect(tree.getByText('Dairy Free')).toBeTruthy();
    expect(tree.getByText(/85% healthy/)).toBeTruthy();
  });

  it('renders saved recipe folder, tags, and notes for backend recipes', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: 'r1',
      externalId: null,
      loading: false,
      error: null,
      backendError: null,
      displayData: {
        title: 'Saved Recipe',
        image: 'https://example.com/img.jpg',
        servings: 4,
        readyInMinutes: 30,
        ingredients: [],
        instructions: [],
      },
      isBackendRecipe: true,
      backendRecipe: { createdBy: { id: 'user-1' } },
      saving: false,
      isSaved: true,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      savedFolder: 'Dinner',
      savedTags: ['quick', 'easy'],
      savedNotes: 'My notes here',
      savedRating: 3,
      cookedCount: 5,
      handleUnfavoriteRecipe: jest.fn(),
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
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
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: 'r1',
      externalId: null,
      loading: false,
      error: null,
      backendError: null,
      displayData: {
        title: 'A Recipe',
        image: null,
        servings: 2,
        ingredients: [],
        instructions: [],
      },
      isBackendRecipe: true,
      backendRecipe: { createdBy: { id: 'other' } },
      saving: false,
      isSaved: true,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('Mark cooked')).toBeTruthy();
  });

  it('renders source attribution with sourceName', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: null,
      externalId: '123',
      loading: false,
      error: null,
      backendError: null,
      displayData: {
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
      isBackendRecipe: false,
      backendRecipe: null,
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('Recipe from AllRecipes')).toBeTruthy();
    expect(tree.getByText('View Original Recipe')).toBeTruthy();
  });

  it('renders "Recipe not found" when no recipeId and no error', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: null,
      externalId: null,
      loading: false,
      error: null,
      backendError: null,
      displayData: null,
      isBackendRecipe: false,
      backendRecipe: null,
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('Recipe not found')).toBeTruthy();
  });

  it('does not render image section when no image', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: null,
      externalId: null,
      loading: false,
      error: null,
      backendError: null,
      displayData: {
        title: 'No Image Recipe',
        image: null,
        servings: 2,
        ingredients: [],
        instructions: [],
      },
      isBackendRecipe: false,
      backendRecipe: null,
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    // Title is rendered but there's no BackButton in image container
    expect(tree.getByText('No Image Recipe')).toBeTruthy();
  });

  it('renders "Adding..." when addingToList is true', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: null,
      externalId: '123',
      loading: false,
      error: null,
      backendError: null,
      displayData: {
        title: 'Recipe',
        image: null,
        servings: 2,
        ingredients: [{ id: 'i1', name: 'Salt' }],
        instructions: [],
      },
      isBackendRecipe: false,
      backendRecipe: null,
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: true,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('Adding...')).toBeTruthy();
  });

  it('renders "None" for folder when savedFolder is null', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: 'r1',
      externalId: null,
      loading: false,
      error: null,
      backendError: null,
      displayData: {
        title: 'Recipe',
        image: null,
        servings: 2,
        ingredients: [],
        instructions: [],
      },
      isBackendRecipe: true,
      backendRecipe: { createdBy: { id: 'other' } },
      saving: false,
      isSaved: true,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('None')).toBeTruthy();
  });

  it('renders with saving state', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: null,
      externalId: '456',
      loading: false,
      error: null,
      backendError: null,
      displayData: {
        title: 'Saving Recipe',
        image: 'https://example.com/img.jpg',
        servings: 4,
        readyInMinutes: 20,
        ingredients: [{ id: 'i1', name: 'Salt' }],
        instructions: [{ number: 1, step: 'Add salt' }],
      },
      isBackendRecipe: false,
      backendRecipe: null,
      saving: true,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [{ id: 'sl-1', name: 'My List' }],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('Saving Recipe')).toBeTruthy();
  });

  it('renders with preloading state', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: null,
      externalId: '789',
      loading: false,
      error: null,
      backendError: null,
      displayData: null,
      isBackendRecipe: false,
      backendRecipe: null,
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: true,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders with instructions present', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: null,
      externalId: '123',
      loading: false,
      error: null,
      backendError: null,
      displayData: {
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
      isBackendRecipe: false,
      backendRecipe: null,
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('With Instructions')).toBeTruthy();
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders with added ingredients highlighted', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: null,
      externalId: '123',
      loading: false,
      error: null,
      backendError: null,
      displayData: {
        title: 'Recipe With Ingredients',
        image: null,
        servings: 2,
        ingredients: [
          { id: 'i1', name: 'Flour', amount: 200, measures: {} },
          { id: 'i2', name: 'Sugar', amount: 100, measures: {} },
        ],
        instructions: [],
      },
      isBackendRecipe: false,
      backendRecipe: null,
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [{ id: 'sl-1', name: 'Weekly' }],
      addingToList: false,
      addedIngredients: new Set(['i1']),
      selectedIngredients: new Set(['i2']),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('Recipe With Ingredients')).toBeTruthy();
  });

  it('renders marking as cooked state', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: 'r1',
      externalId: null,
      loading: false,
      error: null,
      backendError: null,
      displayData: {
        title: 'Cooking Recipe',
        image: null,
        servings: 2,
        ingredients: [],
        instructions: [],
      },
      isBackendRecipe: true,
      backendRecipe: { createdBy: { id: 'user-1' } },
      saving: false,
      isSaved: true,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
      handleSheetDismiss: jest.fn(),
      cookedModalVisible: true,
      setCookedModalVisible: jest.fn(),
      markingAsCooked: true,
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
      cookedCount: 2,
      handleUnfavoriteRecipe: jest.fn(),
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('Cooking Recipe')).toBeTruthy();
  });

  it('renders backend instructions with step/text format correctly', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: 'r1',
      externalId: null,
      loading: false,
      error: null,
      backendError: null,
      displayData: {
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
      isBackendRecipe: true,
      backendRecipe: { createdBy: { id: 'user-1' } },
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('Boil the water')).toBeTruthy();
    expect(tree.getByText('Cook the pasta')).toBeTruthy();
  });

  it('renders no-image header with back button when image is missing', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: 'r1',
      externalId: null,
      loading: false,
      error: null,
      backendError: null,
      displayData: {
        title: 'No Image Recipe',
        image: null,
        servings: 2,
        ingredients: [],
        instructions: [],
      },
      isBackendRecipe: true,
      backendRecipe: { createdBy: { id: 'user-1' } },
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('No Image Recipe')).toBeTruthy();
    // No-image header renders with accessible meal plan button
    expect(tree.getByLabelText('Add to meal plan')).toBeTruthy();
  });

  it('does not show "0 min" when readyInMinutes is 0', () => {
    const { useRecipeDetail } = jest.requireMock(
      '../../../hooks/useRecipeDetail',
    );
    useRecipeDetail.mockReturnValue({
      goBack: jest.fn(),
      recipeId: null,
      externalId: null,
      loading: false,
      error: null,
      backendError: null,
      displayData: {
        title: 'Zero Time Recipe',
        image: null,
        servings: 2,
        readyInMinutes: 0,
        ingredients: [],
        instructions: [],
      },
      isBackendRecipe: false,
      backendRecipe: null,
      saving: false,
      isSaved: false,
      handleSaveRecipe: jest.fn(),
      shoppingLists: [],
      addingToList: false,
      addedIngredients: new Set(),
      selectedIngredients: new Set(),
      handleAddSingleIngredient: jest.fn(),
      handleAddAllIngredientsToList: jest.fn(),
      handleAddAllIngredients: jest.fn(),
      handleAddSelectedIngredients: jest.fn(),
      handleListSelected: jest.fn(),
      toggleIngredient: jest.fn(),
      openIngredientSelector: jest.fn(),
      shoppingListOptionsRef: { current: null },
      ingredientSelectorRef: { current: null },
      listPickerRef: { current: null },
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
      preloading: false,
      preloadedRecipe: null,
    });

    const tree = render(<RecipeDetail />);
    expect(tree.getByText('Zero Time Recipe')).toBeTruthy();
    expect(tree.queryByText(/0 min/)).toBeNull();
  });
});
