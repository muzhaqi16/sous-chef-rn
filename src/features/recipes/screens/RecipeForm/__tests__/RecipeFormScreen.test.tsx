'use no memo';

import React from 'react';
import { userEvent, waitFor } from '@testing-library/react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import {
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  CreateRecipeDocument,
  GetRecipeDocument,
  UpdateRecipeDocument,
} from '#features/recipes/graphql/recipe.generated';
import { alertService } from '#/services/alertService';
import {
  MAX_RECIPE_INGREDIENTS,
  RECIPE_INGREDIENTS_PAGE_SIZE,
} from '#domain/recipeIngredientsPaging';
import { t } from '#/i18n';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { RecipeCaptureStatus } from '#/graphql/generated/schemaTypes';
import { RecipeCaptureDocument } from '#features/recipes/hooks/useRecipeCapture.generated';
import { RecipeFormScreen } from '../index';

type RecipeFormScreenProps = StaticScreenProps<
  { recipeId?: string } | undefined
>;

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(() => true),
}));

jest.mock('#/utils/finallyHelpers');

// The three field components render their refusal so the screen test can see
// WHERE each message landed, which an alert-based check could not tell apart.
jest.mock('#features/recipes/components/recipeForm/RecipeBasicFields', () => ({
  RecipeBasicFields: ({
    errors,
  }: {
    errors?: { name?: { message?: string } };
  }) => {
    const { Text } = require('react-native');
    return errors?.name?.message ? <Text>{errors.name.message}</Text> : null;
  },
}));
jest.mock(
  '#features/recipes/components/recipeForm/RecipeCategoryFields',
  () => ({
    RecipeCategoryFields: () => null,
  }),
);
jest.mock(
  '#features/recipes/components/recipeForm/RecipeIngredientList',
  () => ({
    RecipeIngredientList: ({
      error,
      ingredients,
      onPasteIngredients,
    }: {
      error?: string;
      ingredients: unknown[];
      onPasteIngredients?: () => void;
    }) => {
      const { Text } = require('react-native');
      return (
        <>
          <Text testID="ingredient-count">{ingredients.length}</Text>
          {error ? <Text>{error}</Text> : null}
          {onPasteIngredients ? <Text testID="paste-offered" /> : null}
        </>
      );
    },
  }),
);
jest.mock(
  '#features/recipes/components/recipeForm/RecipeIngredientEditor',
  () => ({
    RecipeIngredientEditor: require('react').forwardRef(() => null),
  }),
);
jest.mock('#features/recipes/components/recipeForm/RecipeStepList', () => ({
  RecipeStepList: ({ error }: { error?: string }) => {
    const { Text } = require('react-native');
    return error ? <Text>{error}</Text> : null;
  },
}));
jest.mock('#features/recipes/components/recipeForm/RecipeStepEditor', () => ({
  RecipeStepEditor: require('react').forwardRef(() => null),
}));
jest.mock('#features/recipes/components/recipeForm/RecipeTagsSection', () => ({
  RecipeTagsSection: () => null,
}));
jest.mock('#components/templates/FormScreen', () => ({
  FormScreen: ({
    children,
    onSave,
    title,
    testID,
  }: {
    children?: React.ReactNode;
    onSave: () => void;
    title: string;
    testID?: string;
  }) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID={testID}>
        <Text>{title}</Text>
        <Pressable testID="save-button" onPress={onSave}>
          <Text>Save</Text>
        </Pressable>
        {children}
      </View>
    );
  },
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => {
  jest.mocked(useFeatureFlag).mockReturnValue(true);
  jest.clearAllMocks();
});

describe('RecipeFormScreen', () => {
  const defaultProps: RecipeFormScreenProps = {
    route: { params: undefined },
  };

  it('renders in create mode', () => {
    const { getByText } = renderWithApollo(
      <RecipeFormScreen {...defaultProps} />,
    );
    expect(getByText('Create Recipe')).toBeTruthy();
  });

  it('offers pasting ingredients while the capability ships', () => {
    const { getByTestId } = renderWithApollo(
      <RecipeFormScreen {...defaultProps} />,
    );
    expect(getByTestId('paste-offered')).toBeTruthy();
  });

  it('is the form as it was without the capability', () => {
    jest.mocked(useFeatureFlag).mockReturnValue(false);
    const { queryByTestId } = renderWithApollo(
      <RecipeFormScreen {...defaultProps} />,
    );
    expect(queryByTestId('paste-offered')).toBeNull();
    expect(queryByTestId(recipesTestIDs.pasteIngredientsInput)).toBeNull();
  });

  it('renders in edit mode with recipeId', () => {
    const props: RecipeFormScreenProps = {
      route: { params: { recipeId: 'recipe-1' } },
    };
    const { getByText } = renderWithApollo(<RecipeFormScreen {...props} />);
    expect(getByText('Edit Recipe')).toBeTruthy();
  });

  // A field the user can fix is reported ON the field. An alert covers the form,
  // and a dismissed alert cannot say which input it meant.
  it('reports an empty form on its fields, not through an alert', async () => {
    const user = userEvent.setup();
    const { getByTestId, findByText } = renderWithApollo(
      <RecipeFormScreen {...defaultProps} />,
    );

    await user.press(getByTestId('save-button'));

    expect(await findByText('Recipe name is required')).toBeTruthy();
    expect(
      await findByText('At least one ingredient is required'),
    ).toBeTruthy();
    expect(
      await findByText('At least one instruction step is required'),
    ).toBeTruthy();
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('renders with test ID', () => {
    const { getByTestId } = renderWithApollo(
      <RecipeFormScreen {...defaultProps} />,
    );
    expect(getByTestId('recipe-form-screen')).toBeTruthy();
  });

  it('does not call create mutation when validation fails', async () => {
    const user = userEvent.setup();
    const create = recordMock(CreateRecipeDocument, {
      data: {
        createRecipe: {
          __typename: 'CreateRecipePayload',
        },
      },
    });
    const { getByTestId } = renderWithApollo(
      <RecipeFormScreen {...defaultProps} />,
      { operationMocks: [create.mock] },
    );

    await user.press(getByTestId('save-button'));

    expect(create.fired).toEqual([]);
  });

  // A caption that lists ingredients and no method ends INCOMPLETE.
  it('opens filled with what an incomplete capture read, saving nothing', async () => {
    type Line = NonNullable<
      NonNullable<
        NonNullable<
          NonNullable<
            MockDataFor<typeof RecipeCaptureDocument>['recipeCapture']
          >['draft']
        >['lines']
      >[number]
    >;
    const lines = ['2 tbsp white miso', '1 tbsp honey', 'salt, to taste'].map(
      (originalText): Line => ({
        __typename: 'ParsedIngredientLine',
        originalText,
        name: originalText,
        quantity: null,
        unit: null,
        item: null,
        candidates: [],
      }),
    );
    const capture = recordMock(RecipeCaptureDocument, {
      data: {
        recipeCapture: {
          __typename: 'RecipeCapture',
          id: 'capture-1',
          status: RecipeCaptureStatus.Incomplete,
          recipe: null,
          draft: {
            __typename: 'RecipeCaptureDraft',
            name: 'Miso salmon',
            lines,
            steps: [],
          },
        },
      },
    });
    const create = recordMock(CreateRecipeDocument, {
      data: { createRecipe: { __typename: 'CreateRecipePayload' } },
    });

    const { getByTestId, findByText } = renderWithApollo(
      <RecipeFormScreen route={{ params: { captureId: 'capture-1' } }} />,
      { operationMocks: [capture.mock, create.mock] },
    );

    await waitFor(() =>
      expect(getByTestId('ingredient-count')).toHaveTextContent('3'),
    );
    expect(
      await findByText('At least one instruction step is required'),
    ).toBeTruthy();
    expect(create.fired).toEqual([]);
  });

  // A save replaces the recipe's whole ingredient list with the form's.
  describe('saving an edit', () => {
    const editProps: RecipeFormScreenProps = {
      route: { params: { recipeId: 'recipe-1' } },
    };

    /** A recipe that passes the form's validation as it loads. */
    const loadedRecipe = (
      hasNextPage: boolean,
    ): MockDataFor<typeof GetRecipeDocument> => ({
      recipe: {
        __typename: 'Recipe',
        id: 'recipe-1',
        version: 3,
        name: 'Feast',
        // Unstated, the mocked schema fills these with text that is no URL.
        imageUrl: null,
        videoUrl: null,
        instructions: [{ step: 1, text: 'Cook' }],
        pendingRevision: null,
        ingredientsConnection: {
          edges: [
            {
              node: {
                __typename: 'RecipeIngredient',
                id: 'ri-1',
                name: 'Salt',
                quantity: 1,
              },
            },
          ],
          pageInfo: {
            hasNextPage,
            endCursor: hasNextPage ? 'cursor-100' : null,
          },
          totalCount: hasNextPage ? 150 : 1,
        },
      },
    });

    const renderEdit = async (hasNextPage: boolean) => {
      const update = recordMock(UpdateRecipeDocument, {
        data: {
          updateRecipe: {
            __typename: 'UpdateRecipePayload',
            recipe: { __typename: 'Recipe', id: 'recipe-1' },
          },
        },
      });
      const rendered = renderWithApollo(<RecipeFormScreen {...editProps} />, {
        operationMocks: [
          recordMock(GetRecipeDocument, { data: loadedRecipe(hasNextPage) })
            .mock,
          update.mock,
        ],
      });
      // The form is filled once the recipe has arrived.
      await waitFor(() =>
        expect(rendered.getByTestId('ingredient-count')).toHaveTextContent('1'),
      );
      return { ...rendered, sent: update.fired };
    };

    it('sends the form of a recipe read whole', async () => {
      const user = userEvent.setup();
      const { sent, getByTestId } = await renderEdit(false);

      await user.press(getByTestId('save-button'));

      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).toEqual({
        input: expect.objectContaining({
          id: 'recipe-1',
          version: 3,
          ingredients: [expect.objectContaining({ name: 'Salt', quantity: 1 })],
        }),
        ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
      });
      expect(alertService.alert).not.toHaveBeenCalled();
    });

    // `hasNextPage` on the one page the form reads: the form holds part of
    // the list, and no field of it can be fixed to make the save whole.
    it('sends nothing for a recipe over the ingredient limit, and says why', async () => {
      const user = userEvent.setup();
      const { sent, getByTestId } = await renderEdit(true);

      await user.press(getByTestId('save-button'));

      await waitFor(() => expect(alertService.alert).toHaveBeenCalledTimes(1));
      expect(alertService.alert).toHaveBeenCalledWith(
        t('labels.error'),
        t('recipes.editIngredientsOverLimit', {
          count: MAX_RECIPE_INGREDIENTS,
        }),
      );
      expect(sent).toEqual([]);
    });

    // A pending edit made elsewhere can propose more than the form allows.
    it('reports a list over the ingredient limit on the ingredients section, not through an alert', async () => {
      const user = userEvent.setup();
      const update = recordMock(UpdateRecipeDocument, {
        data: {
          updateRecipe: {
            __typename: 'UpdateRecipePayload',
            recipe: { __typename: 'Recipe', id: 'recipe-1' },
          },
        },
      });
      const proposedCount = MAX_RECIPE_INGREDIENTS + 1;
      const { getByTestId, findByText } = renderWithApollo(
        <RecipeFormScreen {...editProps} />,
        {
          operationMocks: [
            recordMock(GetRecipeDocument, {
              data: {
                recipe: {
                  ...loadedRecipe(false).recipe,
                  pendingRevision: {
                    __typename: 'RecipeRevision',
                    id: 'rev-1',
                    proposed: {
                      name: 'Feast',
                      imageUrl: null,
                      videoUrl: null,
                      instructions: [{ step: 1, text: 'Cook' }],
                      ingredients: Array.from(
                        { length: proposedCount },
                        (_, sortOrder) => ({
                          name: `Ingredient ${sortOrder}`,
                          quantity: 1,
                          sortOrder,
                        }),
                      ),
                    },
                  },
                },
              },
            }).mock,
            update.mock,
          ],
        },
      );
      await waitFor(() =>
        expect(getByTestId('ingredient-count')).toHaveTextContent(
          String(proposedCount),
        ),
      );

      await user.press(getByTestId('save-button'));

      expect(
        await findByText('A recipe can have at most 100 ingredients'),
      ).toBeTruthy();
      expect(alertService.alert).not.toHaveBeenCalled();
      expect(update.fired).toEqual([]);
    });
  });
});
