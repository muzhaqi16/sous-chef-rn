import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import type { StaticScreenProps } from '@react-navigation/native';
import { FormScreen } from '#components/templates/FormScreen';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import {
  useRecipeFormWrites,
  type RecipeWriteFailure,
} from '#features/recipes/hooks/useRecipeFormWrites';
import { useUser } from '#store/useAppStore';
import { useRecipeForm } from './useRecipeForm';
import { RecipeBasicFields } from '#features/recipes/components/recipeForm/RecipeBasicFields';
import { RecipeCategoryFields } from '#features/recipes/components/recipeForm/RecipeCategoryFields';
import { RecipeIngredientList } from '#features/recipes/components/recipeForm/RecipeIngredientList';
import { useCaptureDraft } from '#features/recipes/hooks/useCaptureDraft';
import { useCaptureReview } from '#features/recipes/hooks/useCaptureReview';
import { useCaptureSources } from '#features/recipes/hooks/useCaptureSources';
import { useRecipeCaptureActions } from '#features/recipes/store/recipeCaptureStore';
import { PasteIngredientsSheet } from '#features/recipes/components/recipeForm/PasteIngredientsSheet';
import { MAX_RECIPE_INGREDIENTS } from '#domain/recipeIngredientsPaging';
import {
  RecipeIngredientEditor,
  type RecipeIngredientEditorRef,
} from '#features/recipes/components/recipeForm/RecipeIngredientEditor';
import { RecipeStepList } from '#features/recipes/components/recipeForm/RecipeStepList';
import {
  RecipeStepEditor,
  type RecipeStepEditorRef,
} from '#features/recipes/components/recipeForm/RecipeStepEditor';
import { RecipeTagsSection } from '#features/recipes/components/recipeForm/RecipeTagsSection';
import type {
  IngredientFormState,
  RecipeFormState,
  StepFormState,
} from './formState';
import type { RecipeCreatedBy } from '#features/recipes/utils/recipeCacheWriters';
import { localizedErrorMessage } from '#/services/errorService';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { logValidationErrors } from '#/utils/validation/common';
import { presentFailure } from '#/utils/errors/presentFailure';

/** The fields whose sections render their own validation message. */
const FIELDS_WITH_MESSAGES: ReadonlyArray<keyof RecipeFormState> = [
  'name',
  'ingredients',
  'steps',
  'tips',
  'tags',
];

export const RecipeFormScreen: React.FC<
  StaticScreenProps<{ recipeId?: string; captureId?: string } | undefined>
> = ({ route }) => {
  useScreenTransition('RecipeForm');
  const recipeId = route.params?.recipeId;
  const captureId = route.params?.captureId;
  const isEditMode = !!recipeId;

  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
  const ingredientEditorRef = useRef<RecipeIngredientEditorRef>(null);
  const stepEditorRef = useRef<RecipeStepEditorRef>(null);

  const form = useRecipeForm();

  const user = useUser();
  const {
    recipeRef,
    readRecipe,
    reloadRecipe,
    createRecipe,
    updateRecipe,
    saving,
  } = useRecipeFormWrites(recipeId);

  // Populate the form once the recipe arrives.
  const { populateFromRecipe } = form;
  useEffect(() => {
    if (!recipeRef) return;
    const recipe = readRecipe();
    if (recipe) {
      populateFromRecipe(recipe);
    }
  }, [recipeRef, readRecipe, populateFromRecipe]);

  // An incomplete capture fills a new recipe once, when its draft is read.
  const { draft: captureDraft, link: captureLink } = useCaptureDraft(captureId);
  const { populateFromCapture } = form;
  const filledFrom = useRef<string | null>(null);
  useEffect(() => {
    if (!captureId || !captureDraft || filledFrom.current === captureId) return;
    filledFrom.current = captureId;
    populateFromCapture(captureDraft, captureLink);
  }, [captureId, captureDraft, captureLink, populateFromCapture]);
  const { settle: settleCapture } = useRecipeCaptureActions();

  // A landed save leaves from an effect: by then the render has turned the
  // discard guard off, which a `goBack` in the save handler would still meet.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (saved) goBack();
  }, [saved, goBack]);
  const unsavedChanges = form.isDirty && !saved;

  // A refusal naming a field the form renders a message for lands on it. An
  // edit made elsewhere since the form loaded offers to reload the form from it.
  const reportFailure = (failure: RecipeWriteFailure) => {
    const field = FIELDS_WITH_MESSAGES.find(name => name === failure.field);
    if (field) {
      form.setError(field, { type: 'server', message: failure.body });
      return;
    }
    presentFailure(failure, {
      onConflictRefresh: () => {
        void reloadRecipe().then(recipe => {
          if (recipe) {
            populateFromRecipe(recipe);
            return;
          }
          // The form keeps what was typed: resetting it to the copy the save
          // was refused against would lose the edit and conflict again.
          alertService.alert(
            t('recipes.loadFailed'),
            t('errors.codes.genericRetry'),
          );
        });
      },
    });
  };

  const onValid = async () => {
    // The save body is a local runner so the try holds one plain call: a
    // `?.`/`??`/ternary inside a try body bails the component out of the React
    // Compiler.
    const runSave = async () => {
      if (isEditMode && recipeId) {
        const outcome = await updateRecipe(recipeId, form.buildUpdateInput());
        if (outcome.status === 'ok') {
          setSaved(true);
          return;
        }
        reportFailure(outcome.failure);
        return;
      }

      const createdBy: RecipeCreatedBy = user
        ? {
            __typename: 'User',
            id: user.id,
            email: user.email,
            displayName: user.displayName ?? null,
          }
        : null;
      const outcome = await createRecipe(form.buildCreateInput(), createdBy);
      if (outcome.status === 'ok') {
        // The capture it finished leaves the Recipes tab.
        if (captureId) settleCapture(captureId);
        setSaved(true);
        return;
      }
      reportFailure(outcome.failure);
    };

    try {
      await runSave();
    } catch (err: unknown) {
      alertService.alert(
        t('labels.error'),
        localizedErrorMessage(err, t('recipes.unexpectedError')),
      );
    }
  };

  // A field the user can fix is reported ON the field: the list sections carry
  // their own message, and the basic fields render theirs under the input.
  const handleSave = form.handleSubmit(onValid, logValidationErrors);

  // Ingredient handlers
  const handleEditIngredient = (ingredient: IngredientFormState) => {
    ingredientEditorRef.current?.open(ingredient);
  };

  const handleAddIngredient = () => {
    ingredientEditorRef.current?.open();
  };

  const [pasteVisible, setPasteVisible] = useState(false);
  const pasteEnabled = useFeatureFlag('ingredientPaste');
  // A captured recipe's unlinked lines offer the items its capture proposed.
  const captureSources = useCaptureSources();
  const { review: captureReview } = useCaptureReview(
    captureSources.any ? recipeId : undefined,
  );

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
      <FormScreen
        title={isEditMode ? t('recipes.editRecipe') : t('recipes.createRecipe')}
        onClose={goBack}
        onSave={handleSave}
        loading={saving}
        unsavedChanges={unsavedChanges}
        testID={recipesTestIDs.recipeFormScreen}
      >
        {/* Basic fields */}
        <RecipeBasicFields
          state={form.state}
          updateField={form.updateField}
          errors={form.errors}
        />

        {/* Category fields */}
        <RecipeCategoryFields
          state={form.state}
          updateField={form.updateField}
        />

        {/* Ingredients */}
        <RecipeIngredientList
          ingredients={form.state.ingredients}
          error={form.errors.ingredients?.message}
          onEditIngredient={handleEditIngredient}
          onRemoveIngredient={form.removeIngredient}
          onAddIngredient={handleAddIngredient}
          onPasteIngredients={
            pasteEnabled ? () => setPasteVisible(true) : undefined
          }
        />

        {/* Steps */}
        <RecipeStepList
          steps={form.state.steps}
          error={form.errors.steps?.message}
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
      </FormScreen>

      {/* Bottom sheet editors */}
      <RecipeIngredientEditor
        ref={ingredientEditorRef}
        onSave={handleSaveIngredient}
        candidatesFor={captureReview?.candidatesFor}
      />
      <RecipeStepEditor ref={stepEditorRef} onSave={handleSaveStep} />
      {pasteEnabled ? (
        <PasteIngredientsSheet
          visible={pasteVisible}
          onDismiss={() => setPasteVisible(false)}
          room={Math.max(
            0,
            MAX_RECIPE_INGREDIENTS - form.state.ingredients.length,
          )}
          onPasted={form.appendIngredients}
        />
      ) : null}
    </>
  );
};
