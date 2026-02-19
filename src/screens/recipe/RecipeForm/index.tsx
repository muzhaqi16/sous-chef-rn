import React, { useCallback, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { FormModal } from '#components/organisms/FormModal';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  useGetRecipeQuery,
  useCreateRecipeMutation,
  useUpdateRecipeMutation,
} from '#generated';
import { useRecipeForm } from './useRecipeForm';
import { RecipeBasicFields } from './components/RecipeBasicFields';
import { RecipeCategoryFields } from './components/RecipeCategoryFields';
import { RecipeIngredientList } from './components/RecipeIngredientList';
import { RecipeIngredientEditor, type RecipeIngredientEditorRef } from './components/RecipeIngredientEditor';
import { RecipeStepList } from './components/RecipeStepList';
import { RecipeStepEditor, type RecipeStepEditorRef } from './components/RecipeStepEditor';
import { RecipeTagsSection } from './components/RecipeTagsSection';
import type { IngredientFormState, StepFormState } from './useRecipeForm';

export const RecipeFormScreen: React.FC = () => {
  const route = useRoute();
  const recipeId = (route.params as any)?.recipeId as string | undefined;
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
  useEffect(() => {
    if (recipeData?.recipe) {
      form.populateFromRecipe(recipeData.recipe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeData?.recipe]);

  const [createRecipeMutation, { loading: creating }] = useCreateRecipeMutation();
  const [updateRecipeMutation, { loading: updating }] = useUpdateRecipeMutation();
  const loading = creating || updating;

  const handleSave = useCallback(async () => {
    const error = form.validate();
    if (error) {
      Alert.alert('Validation Error', error);
      return;
    }

    try {
      if (isEditMode && recipeId) {
        const input = form.buildUpdateInput();
        const result = await updateRecipeMutation({
          variables: { id: recipeId, input },
        });
        if (result.data?.updateRecipe?.success) {
          goBack();
        } else {
          Alert.alert('Error', result.data?.updateRecipe?.message ?? 'Failed to update recipe.');
        }
      } else {
        const input = form.buildCreateInput();
        const result = await createRecipeMutation({
          variables: { input },
        });
        if (result.data?.createRecipe?.success) {
          goBack();
        } else {
          Alert.alert('Error', result.data?.createRecipe?.message ?? 'Failed to create recipe.');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'An unexpected error occurred.');
    }
  }, [form, isEditMode, recipeId, createRecipeMutation, updateRecipeMutation, goBack]);

  // Ingredient handlers
  const handleEditIngredient = useCallback((ingredient: IngredientFormState) => {
    ingredientEditorRef.current?.open(ingredient);
  }, []);

  const handleAddIngredient = useCallback(() => {
    ingredientEditorRef.current?.open();
  }, []);

  const handleSaveIngredient = useCallback(
    (ingredient: IngredientFormState) => {
      // Check if this is an existing ingredient being edited
      const existing = form.state.ingredients.find(i => i.id === ingredient.id);
      if (existing) {
        form.updateIngredient(ingredient.id, ingredient);
      } else {
        form.addIngredient(ingredient);
      }
    },
    [form],
  );

  // Step handlers
  const handleEditStep = useCallback((step: StepFormState) => {
    stepEditorRef.current?.open(step);
  }, []);

  const handleAddStep = useCallback(() => {
    stepEditorRef.current?.open();
  }, []);

  const handleSaveStep = useCallback(
    (step: StepFormState) => {
      const existing = form.state.steps.find(s => s.id === step.id);
      if (existing) {
        form.updateStep(step.id, step.instruction);
      } else {
        form.addStep(step.instruction);
      }
    },
    [form],
  );

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
        <RecipeCategoryFields state={form.state} updateField={form.updateField} />

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
      <RecipeIngredientEditor ref={ingredientEditorRef} onSave={handleSaveIngredient} />
      <RecipeStepEditor ref={stepEditorRef} onSave={handleSaveStep} />
    </>
  );
};
