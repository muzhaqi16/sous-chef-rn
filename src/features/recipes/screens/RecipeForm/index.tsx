import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  MyRecipesDocument,
  type MyRecipesQuery,
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
import type { ApolloCache } from '@apollo/client';
import {
  Difficulty,
  RecipeCategory,
  type CreateRecipeInput,
} from '#/graphql/generated/schemaTypes';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import { generateEntityId } from '#/utils/generateEntityId';

/** The (unmasked) MyRecipes edge node shape the list reads per row. */
type MyRecipesEdgeNode = {
  __typename: 'Recipe';
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  servings: number;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  category: RecipeCategory;
  difficulty: Difficulty;
  savedDetails: {
    __typename: 'SavedRecipe';
    id: string;
    folder: string | null;
  } | null;
};

/** The MyRecipes edge node a local-first create materializes. */
function buildOptimisticRecipeNode(
  id: string,
  input: CreateRecipeInput,
): MyRecipesEdgeNode {
  const prep = input.prepTimeMinutes ?? null;
  const cook = input.cookTimeMinutes ?? null;
  return {
    __typename: 'Recipe',
    id,
    name: input.name,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    servings: input.servings ?? 4,
    prepTimeMinutes: prep,
    cookTimeMinutes: cook,
    totalTimeMinutes:
      prep != null || cook != null ? (prep ?? 0) + (cook ?? 0) : null,
    // The list node selects these non-null; mirror the server-side defaults
    // when the form leaves them unset.
    category: input.category ?? RecipeCategory.MainCourse,
    difficulty: input.difficulty ?? Difficulty.Easy,
    savedDetails: null,
  };
}

/**
 * Insert-or-replace a recipe edge in MyRecipes. Shared by the local-first
 * pre-fire write (insert) and the mutation's update callback (replace — the
 * server row carries the same client-minted id, so the optimistic node is
 * upgraded in place instead of duplicated).
 */
function upsertMyRecipesEdge(
  cache: ApolloCache,
  node: MyRecipesEdgeNode,
): void {
  cache.updateQuery<MyRecipesQuery>({ query: MyRecipesDocument }, existing => {
    if (!existing?.recipes) return existing;
    const present = existing.recipes.edges.some(
      edge => edge.node.id === node.id,
    );
    return {
      ...existing,
      recipes: {
        ...existing.recipes,
        edges: present
          ? existing.recipes.edges.map(edge =>
              edge.node.id === node.id ? { ...edge, node } : edge,
            )
          : [
              { __typename: 'RecipeEdge', cursor: node.id, node },
              ...existing.recipes.edges,
            ],
        totalCount: present
          ? existing.recipes.totalCount
          : (existing.recipes.totalCount ?? 0) + 1,
      },
    };
  });
}

/** Remove a recipe edge from MyRecipes (revert of a rejected create). */
function removeMyRecipesEdge(cache: ApolloCache, id: string): void {
  cache.updateQuery<MyRecipesQuery>({ query: MyRecipesDocument }, existing => {
    if (!existing?.recipes) return existing;
    const present = existing.recipes.edges.some(edge => edge.node.id === id);
    if (!present) return existing;
    return {
      ...existing,
      recipes: {
        ...existing.recipes,
        edges: existing.recipes.edges.filter(edge => edge.node.id !== id),
        totalCount: (existing.recipes.totalCount ?? 0) - 1,
      },
    };
  });
}

export const RecipeFormScreen: React.FC<
  StaticScreenProps<{ recipeId?: string } | undefined>
> = ({ route }) => {
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
        // Upsert: the local-first pre-fire write already inserted the edge
        // under the same client-minted id — the server row replaces it.
        upsertMyRecipesEdge(cache, data.createRecipe.recipe);
      },
    },
  );
  const [updateRecipeMutation, { loading: updating }] =
    useMutation(UpdateRecipeDocument);
  const [updateRecipeIngredientsMutation, { loading: updatingIngredients }] =
    useMutation(UpdateRecipeIngredientsDocument);
  const loading = creating || updating || updatingIngredients;

  const handleSave = () => {
    const error = form.validate();
    if (error) {
      alertService.alert(t('recipes.validationError'), error);
      return;
    }

    executeMutation(
      async () => {
        if (isEditMode && recipeId) {
          const input = form.buildUpdateInput();
          // Local-first: both edits queue together offline and replay in FIFO
          // order against the same recipe id (the queue serializes same-entity
          // ops). The local display catches up when the replay syncs.
          const [updateResult, ingredientsResult] = await Promise.all([
            updateRecipeMutation({
              variables: { input: { ...input, id: recipeId } },
              context: { localFirst: true },
            }),
            updateRecipeIngredientsMutation({
              variables: {
                input: {
                  recipeId,
                  ingredients: form.buildIngredientsInput(),
                },
              },
              context: { localFirst: true },
            }),
          ]);
          // 'queued' (null payload, no error) counts as success — the edit
          // replays on reconnect.
          const recipeSuccess =
            classifyCreateResult(
              updateResult,
              'updateRecipe',
              'UpdateRecipePayload',
            ) !== 'rejected';
          const ingredientsSuccess =
            classifyCreateResult(
              ingredientsResult,
              'updateRecipeIngredients',
              'UpdateRecipeIngredientsPayload',
            ) !== 'rejected';
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
          // Local-first: mint the permanent cuid (the row's real PK) and put
          // the recipe into My Recipes before firing, so creating works fully
          // offline — the queued create replays keyed by this same id.
          const id = generateEntityId();
          executeCacheUpdate(
            () =>
              upsertMyRecipesEdge(
                apolloClient.cache,
                buildOptimisticRecipeNode(id, input),
              ),
            'Create Recipe (optimistic)',
          );
          const result = await createRecipeMutation({
            variables: { input: { ...input, id } },
            context: { localFirst: true },
          });
          const outcome = classifyCreateResult(
            result,
            'createRecipe',
            'CreateRecipePayload',
          );
          if (outcome !== 'rejected') {
            // Online success or queued offline — the recipe is in My Recipes
            // either way.
            goBack();
          } else {
            executeCacheUpdate(
              () => removeMyRecipesEdge(apolloClient.cache, id),
              'Revert rejected Recipe create',
            );
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
      },
      (err: unknown) => {
        const message =
          err instanceof Error ? err.message : t('recipes.unexpectedError');
        alertService.alert(t('labels.error'), message);
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
