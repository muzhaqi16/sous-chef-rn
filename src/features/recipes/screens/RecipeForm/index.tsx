import React, { useRef, useEffect } from 'react';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import type { StaticScreenProps } from '@react-navigation/native';
import { FormModal } from '#components/organisms/FormModal';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import {
  GetRecipeDocument,
  CreateRecipeDocument,
  UpdateRecipeDocument,
  UpdateRecipeIngredientsDocument,
} from '#features/recipes/graphql/recipe.generated';
import {
  RecipeForm_RecipeFragmentDoc,
  type RecipeForm_RecipeFragment,
} from './RecipeForm.generated';
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
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { generateEntityId } from '#/utils/generateEntityId';
import { upsertMyRecipesEdge } from './recipeCacheWriters';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { toastService } from '#/services/toastService';
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

  // Fetch recipe for edit mode
  const { data: recipeData } = useQuery(GetRecipeDocument, {
    variables: { id: recipeId! },
    skip: !recipeId,
  });

  // Materialize the masked recipe ref into the form's own narrow fragment so
  // populateFromRecipe sees the fields it needs (non-render context —
  // useFragment is a hook and can't run inside useEffect).
  const apolloClient = useApolloClient();
  const recipeRef = recipeData?.recipe ?? null;

  // Populate form when recipe data arrives
  const { populateFromRecipe } = form;
  useEffect(() => {
    if (!recipeRef) return;
    const recipe = apolloClient.cache.readFragment<RecipeForm_RecipeFragment>({
      fragment: RecipeForm_RecipeFragmentDoc,
      fragmentName: 'RecipeForm_recipe',
      from: recipeRef,
    });
    if (recipe) {
      populateFromRecipe(recipe);
    }
  }, [recipeRef, populateFromRecipe, apolloClient]);

  const [createRecipeMutation, { loading: creating }] = useMutation(
    CreateRecipeDocument,
    {
      update: (cache, { data }) => {
        if (data?.createRecipe?.__typename !== 'CreateRecipePayload') return;
        // Reconciles the server's row into the My Recipes connection; upsert
        // because an idempotent replay can return an edge that is already there.
        upsertMyRecipesEdge(cache, data.createRecipe.recipe);
      },
    },
  );
  const [updateRecipeMutation, { loading: updating }] =
    useMutation(UpdateRecipeDocument);
  const [updateRecipeIngredientsMutation, { loading: updatingIngredients }] =
    useMutation(UpdateRecipeIngredientsDocument);
  const loading = creating || updating || updatingIngredients;
  const isApiUnavailable = useIsApiUnavailable();

  const handleSave = async () => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return;
    }

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
        const input = form.buildUpdateInput();
        const [updateResult, ingredientsResult] = await Promise.all([
          updateRecipeMutation({
            variables: { input: { ...input, id: recipeId } },
          }),
          updateRecipeIngredientsMutation({
            variables: {
              input: {
                recipeId,
                ingredients: form.buildIngredientsInput(),
              },
            },
          }),
        ]);
        const recipeSuccess = classifyCreateResult(updateResult) !== 'rejected';
        const ingredientsSuccess =
          classifyCreateResult(ingredientsResult) !== 'rejected';
        if (recipeSuccess && ingredientsSuccess) {
          goBack();
        } else {
          const updatePayload = updateResult.data?.updateRecipe;
          const ingredientsPayload =
            ingredientsResult.data?.updateRecipeIngredients;
          const updateMsg =
            updatePayload && 'message' in updatePayload
              ? updatePayload.message
              : null;
          const ingredientsMsg =
            ingredientsPayload && 'message' in ingredientsPayload
              ? ingredientsPayload.message
              : null;
          alertService.alert(
            t('labels.error'),
            updateMsg ?? ingredientsMsg ?? t('recipes.updateRecipeFailed'),
          );
        }
      } else {
        const input = form.buildCreateInput();
        // Client-minted permanent cuid: it is the row's real PK, so a retry
        // whose first response was lost comes back as IDEMPOTENT_REPLAY rather
        // than creating a second recipe.
        const id = generateEntityId();
        const result = await createRecipeMutation({
          variables: { input: { ...input, id } },
        });
        const outcome = classifyCreateResult(result);
        if (outcome !== 'rejected') {
          goBack();
        } else {
          const createPayload = result.data?.createRecipe;
          const message =
            createPayload && 'message' in createPayload
              ? createPayload.message
              : null;
          alertService.alert(
            t('labels.error'),
            message ?? t('recipes.createRecipeFailed'),
          );
        }
      }
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
