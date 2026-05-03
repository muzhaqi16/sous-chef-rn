import React, { useRef, useEffect } from 'react';
import { alertService } from '#/services/alertService';
import type { StaticScreenProps } from '@react-navigation/native';
import { FormModal } from '#components/organisms/FormModal';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  useGetRecipeQuery,
  useCreateRecipeMutation,
  useUpdateRecipeMutation,
  useUpdateRecipeIngredientsMutation,
  MyRecipesDocument,
  type MyRecipesQuery,
} from '#generated';
import { useRecipeForm } from './useRecipeForm';
import { RecipeBasicFields } from './components/RecipeBasicFields';
import { RecipeCategoryFields } from './components/RecipeCategoryFields';
import { RecipeIngredientList } from './components/RecipeIngredientList';
import {
  RecipeIngredientEditor,
  type RecipeIngredientEditorRef,
} from './components/RecipeIngredientEditor';
import { RecipeStepList } from './components/RecipeStepList';
import {
  RecipeStepEditor,
  type RecipeStepEditorRef,
} from './components/RecipeStepEditor';
import { RecipeTagsSection } from './components/RecipeTagsSection';
import type { IngredientFormState, StepFormState } from './useRecipeForm';
import { executeMutation } from '#/utils/compilerSafeWrappers';

export const RecipeFormScreen: React.FC<
  StaticScreenProps<{ recipeId?: string } | undefined>
> = ({ route }) => {
  const recipeId = route.params?.recipeId;
  const isEditMode = !!recipeId;

  const { goBack } = useAppNavigation();
  const ingredientEditorRef = useRef<RecipeIngredientEditorRef>(null);
  const stepEditorRef = useRef<RecipeStepEditorRef>(null);

  const form = useRecipeForm();

  // Fetch recipe for edit mode
  const { data: recipeData } = useGetRecipeQuery({
    variables: { id: recipeId! },
    skip: !recipeId,
  });

  // Populate form when recipe data arrives
  const { populateFromRecipe } = form;
  useEffect(() => {
    if (recipeData?.recipe) {
      populateFromRecipe(recipeData.recipe);
    }
  }, [recipeData?.recipe, populateFromRecipe]);

  const [createRecipeMutation, { loading: creating }] = useCreateRecipeMutation(
    {
      update: (cache, { data }) => {
        if (!data?.createRecipe?.success || !data.createRecipe.recipe) return;
        const newRecipe = data.createRecipe.recipe;
        cache.updateQuery<MyRecipesQuery>(
          { query: MyRecipesDocument },
          existing => {
            if (!existing?.recipes) return existing;
            return {
              ...existing,
              recipes: {
                ...existing.recipes,
                edges: [
                  {
                    __typename: 'RecipeEdge',
                    cursor: newRecipe.id,
                    node: newRecipe,
                  },
                  ...existing.recipes.edges,
                ],
                totalCount: (existing.recipes.totalCount ?? 0) + 1,
              },
            };
          },
        );
      },
    },
  );
  const [updateRecipeMutation, { loading: updating }] =
    useUpdateRecipeMutation();
  const [updateRecipeIngredientsMutation, { loading: updatingIngredients }] =
    useUpdateRecipeIngredientsMutation();
  const loading = creating || updating || updatingIngredients;

  const handleSave = () => {
    const error = form.validate();
    if (error) {
      alertService.alert('Validation Error', error);
      return;
    }

    executeMutation(
      async () => {
        if (isEditMode && recipeId) {
          const input = form.buildUpdateInput();
          const [updateResult, ingredientsResult] = await Promise.all([
            updateRecipeMutation({
              variables: { id: recipeId, input },
            }),
            updateRecipeIngredientsMutation({
              variables: {
                recipeId,
                ingredients: form.buildIngredientsInput(),
              },
            }),
          ]);
          const recipeSuccess = updateResult.data?.updateRecipe?.success;
          const ingredientsSuccess =
            ingredientsResult.data?.updateRecipeIngredients?.success;
          if (recipeSuccess && ingredientsSuccess) {
            goBack();
          } else {
            const errorMessage =
              updateResult.data?.updateRecipe?.message ??
              ingredientsResult.data?.updateRecipeIngredients?.message ??
              'Failed to update recipe.';
            alertService.alert('Error', errorMessage);
          }
        } else {
          const input = form.buildCreateInput();
          const result = await createRecipeMutation({
            variables: { input },
          });
          if (result.data?.createRecipe?.success) {
            goBack();
          } else {
            alertService.alert(
              'Error',
              result.data?.createRecipe?.message ?? 'Failed to create recipe.',
            );
          }
        }
      },
      (err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred.';
        alertService.alert('Error', message);
      },
    );
  };

  // Ingredient handlers
  const handleEditIngredient = (ingredient: IngredientFormState) => {
    ingredientEditorRef.current?.open(ingredient);
  };

  const handleAddIngredient = () => {
    ingredientEditorRef.current?.open();
  };

  const handleSaveIngredient = (ingredient: IngredientFormState) => {
    // Check if this is an existing ingredient being edited
    const existing = form.state.ingredients.find(i => i.id === ingredient.id);
    if (existing) {
      form.updateIngredient(ingredient.id, ingredient);
    } else {
      form.addIngredient(ingredient);
    }
  };

  // Step handlers
  const handleEditStep = (step: StepFormState) => {
    stepEditorRef.current?.open(step);
  };

  const handleAddStep = () => {
    stepEditorRef.current?.open();
  };

  const handleSaveStep = (step: StepFormState) => {
    const existing = form.state.steps.find(s => s.id === step.id);
    if (existing) {
      form.updateStep(step.id, step.instruction);
    } else {
      form.addStep(step.instruction);
    }
  };

  return (
    <>
      <FormModal
        title={isEditMode ? 'Edit Recipe' : 'Create Recipe'}
        onClose={goBack}
        onSave={handleSave}
        loading={loading}
        testID="recipe-form-screen"
      >
        {/* Basic fields */}
        <RecipeBasicFields state={form.state} updateField={form.updateField} />

        {/* Category fields */}
        <RecipeCategoryFields
          state={form.state}
          updateField={form.updateField}
        />

        {/* Ingredients */}
        <RecipeIngredientList
          ingredients={form.state.ingredients}
          onEditIngredient={handleEditIngredient}
          onRemoveIngredient={form.removeIngredient}
          onAddIngredient={handleAddIngredient}
        />

        {/* Steps */}
        <RecipeStepList
          steps={form.state.steps}
          onEditStep={handleEditStep}
          onRemoveStep={form.removeStep}
          onAddStep={handleAddStep}
        />

        {/* Tags */}
        <RecipeTagsSection
          diets={form.state.diets}
          healthGoals={form.state.healthGoals}
          intolerances={form.state.intolerances}
          onDietsChange={form.setDiets}
          onHealthGoalsChange={form.setHealthGoals}
          onIntolerancesChange={form.setIntolerances}
        />
      </FormModal>

      {/* Bottom sheet editors */}
      <RecipeIngredientEditor
        ref={ingredientEditorRef}
        onSave={handleSaveIngredient}
      />
      <RecipeStepEditor ref={stepEditorRef} onSave={handleSaveStep} />
    </>
  );
};
