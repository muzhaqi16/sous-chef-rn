import React, { useRef, useEffect } from 'react';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import type { StaticScreenProps } from '@react-navigation/native';
import { FormModal } from '#components/organisms/FormModal';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useRecipeFormWrites } from '#features/recipes/hooks/useRecipeFormWrites';
import { useUser } from '#store/useAppStore';
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
import type { RecipeCreatedBy } from '#features/recipes/utils/recipeCacheWriters';
import { localizedRefusalMessage } from '#/apollo/utils/alertRejectedMutation';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';

export const RecipeFormScreen: React.FC<
  StaticScreenProps<{ recipeId?: string } | undefined>
> = ({ route }) => {
  useScreenTransition('RecipeForm');
  const recipeId = route.params?.recipeId;
  const isEditMode = !!recipeId;

  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
  const ingredientEditorRef = useRef<RecipeIngredientEditorRef>(null);
  const stepEditorRef = useRef<RecipeStepEditorRef>(null);

  const form = useRecipeForm();

  const user = useUser();
  const { recipeRef, readRecipe, createRecipe, updateRecipe, saving } =
    useRecipeFormWrites(recipeId);

  // Populate the form once the recipe arrives.
  const { populateFromRecipe } = form;
  useEffect(() => {
    if (!recipeRef) return;
    const recipe = readRecipe();
    if (recipe) {
      populateFromRecipe(recipe);
    }
  }, [recipeRef, readRecipe, populateFromRecipe]);

  const handleSave = async () => {
    const error = form.validate();
    if (error) {
      alertService.alert(t('labels.validationError'), error);
      return;
    }

    // The save body is held in a local runner so the try below contains a
    // single plain call: the React Compiler bails out of this component when a
    // `?.`/`??`/ternary appears inside a try body, and this flow is full of
    // them. The catch still covers the whole body.
    const runSave = async () => {
      if (isEditMode && recipeId) {
        const outcome = await updateRecipe(
          recipeId,
          form.buildUpdateInput(),
          form.buildIngredientsInput(),
        );
        if (outcome.status === 'ok') {
          goBack();
          return;
        }
        alertService.alert(
          t('labels.error'),
          localizedRefusalMessage(
            outcome.payload,
            t('recipes.updateRecipeFailed'),
          ),
        );
        return;
      }

      const createdBy: RecipeCreatedBy = user
        ? { __typename: 'User', id: user.id, email: user.email }
        : null;
      const outcome = await createRecipe(form.buildCreateInput(), createdBy);
      if (outcome.status === 'ok') {
        goBack();
        return;
      }
      alertService.alert(
        t('labels.error'),
        localizedRefusalMessage(
          outcome.payload,
          t('recipes.createRecipeFailed'),
        ),
      );
    };

    try {
      await runSave();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t('recipes.unexpectedError');
      alertService.alert(t('labels.error'), message);
    }
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
        title={isEditMode ? t('recipes.editRecipe') : t('recipes.createRecipe')}
        onClose={goBack}
        onSave={handleSave}
        loading={saving}
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
