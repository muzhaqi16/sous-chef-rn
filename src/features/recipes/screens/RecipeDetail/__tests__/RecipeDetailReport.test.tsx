'use no memo';

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ModerationContentType } from '#/graphql/generated/schemaTypes';
import { useStore } from '#store';
import { recipesTestIDs } from '#features/recipes/testIDs';
import type { ReportContentSheet } from '#features/profile/ui/ReportContentSheet';
import { RecipeDetail } from '../index';

// Capture's review banner has its own suite; this one renders without Apollo.
jest.mock('#hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => false,
}));
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#features/recipes/hooks/useRecipeDetail', () => ({
  useRecipeDetail: jest.fn(),
}));
jest.mock('#features/recipes/hooks/useRecipeFolders', () => ({
  useRecipeFolders: () => ({ folders: [] }),
}));
jest.mock('#features/recipes/hooks/useRecipeTags', () => ({
  useRecipeTags: () => ({ tags: [] }),
}));
jest.mock('#features/recipes/hooks/useRecipeReviews', () => ({
  useRecipeReviews: () => ({ state: {}, actions: {} }),
}));
jest.mock('#features/recipes/hooks/useForkRecipe', () => ({
  useForkRecipe: () => ({ forkRecipe: jest.fn(), forking: false }),
}));
jest.mock('#features/recipes/hooks/usePublishRecipe', () => ({
  usePublishRecipe: () => ({ setSubmitted: jest.fn(), publishing: false }),
}));
jest.mock('#components/providers/ScreenErrorBoundary', () => ({
  RecipeDetailErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    children,
}));
jest.mock('#features/recipes/components/FolderPicker', () => ({
  FolderPicker: () => null,
}));
jest.mock('#features/shoppingList/ui/ShoppingListPickerSheet', () => ({
  ShoppingListPickerSheet: () => null,
}));
jest.mock('#features/recipes/ui/MarkCookedModal', () => ({
  MarkCookedModal: () => null,
}));
jest.mock(
  '#features/recipes/components/modals/IngredientMatchingSheet',
  () => ({ IngredientMatchingSheet: () => null }),
);
jest.mock(
  '#features/recipes/components/modals/SaveRecipeSheet/SaveRecipeSheet',
  () => ({ SaveRecipeSheet: () => null }),
);
jest.mock(
  '#features/recipes/components/modals/ManageRecipeSheet/ManageRecipeSheet',
  () => ({ ManageRecipeSheet: () => null }),
);
jest.mock(
  '#features/mealPlan/components/AddToMealPlanSheet/AddToMealPlanSheet',
  () => ({ AddToMealPlanSheet: () => null }),
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

const VIEWER = {
  id: 'viewer',
  email: 'viewer@example.com',
  emailVerified: true,
  onBoarded: true,
  preferredCurrency: 'USD',
};

const route = { params: {} };

function renderRecipe(createdBy: { id: string } | null) {
  const { useRecipeDetail } = jest.requireMock<{
    useRecipeDetail: jest.Mock;
  }>('#features/recipes/hooks/useRecipeDetail');
  useRecipeDetail.mockReturnValue({
    goBack: jest.fn(),
    recipeId: 'recipe-1',
    loading: false,
    error: null,
    refreshing: false,
    displayData: {
      dataAttributions: [],
      details: 'complete',
      title: 'Spinach Strata',
      image: null,
      ingredients: [],
      instructions: [],
    },
    backendRecipe: { id: 'recipe-1', createdBy },
    isSaved: false,
    addedIngredients: new Set(),
    ingredientMatching: { isSheetVisible: false, editableMatches: [] },
    savedTags: [],
  });
  render(<RecipeDetail route={route} />);
}

const reportButton = () => screen.queryByTestId(recipesTestIDs.reportButton);

beforeEach(() => {
  useStore.setState({ user: VIEWER });
});

afterEach(() => {
  useStore.setState({ user: null });
});

describe('reporting a recipe from its detail screen', () => {
  it("opens the report for another user's recipe, naming it and its owner", () => {
    renderRecipe({ id: 'owner' });

    const button = reportButton();
    expect(button).toBeTruthy();
    expect(screen.queryByTestId('report-sheet')).toBeNull();
    if (button) fireEvent.press(button);

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

    expect(screen.getByTestId(recipesTestIDs.editButton)).toBeTruthy();
    expect(reportButton()).toBeNull();
  });

  it('offers no report on a catalog recipe, which nobody owns', () => {
    renderRecipe(null);

    expect(screen.getByTestId(recipesTestIDs.forkButton)).toBeTruthy();
    expect(reportButton()).toBeNull();
  });
});
