import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  CreateMealTemplateDocument,
  DeleteMealTemplateDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import { CreateMealPlanItemDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { planFromTemplate } from '#features/mealPlan/utils/planFromTemplate';
import { templateFromPlan } from '#features/mealPlan/utils/templateFromPlan';
import { duplicateTemplate as deriveTemplateCopy } from '#features/mealPlan/utils/duplicateTemplate';
import { writeLocalMealTemplate } from '#features/mealPlan/cache/mealTemplate';
import { useMealPlanActions } from '#features/mealPlan/hooks/useMealPlanActions';
import { writeLocalMealPlanItem } from '#features/mealPlan/cache/mealPlanItem';
import { useUser } from '#store/useAppStore';
import { generateEntityId } from '#/utils/generateEntityId';
import {
  MealTemplateDisplayFragmentDoc,
  type MealTemplateDisplayFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';
import {
  MealPlanType,
  type CreateMealTemplateInput,
  type TemplateCategory,
} from '#/graphql/generated/schemaTypes';
import {
  readPlanSource,
  readTemplateSource,
} from '#features/mealPlan/cache/derivationSources';
import { toastService } from '#/services/toastService';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { Telemetry } from '#/services/telemetry';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';
import {
  createAddToQueryConnectionUpdater,
  skipUnmatchedFilterVariants,
} from '#/apollo/utils/cacheUpdaters';
import { useTranslation } from '#/i18n';
import { errorService } from '#/services/errorService';
import { removeFromMealTemplates } from '#features/mealPlan/cache/removals';
import { settleMealTemplateDelete } from '#features/mealPlan/offline/replayReconcilers';

const addToMealTemplates = createAddToQueryConnectionUpdater(
  'mealTemplates',
  'MealTemplate',
);

/** What a plan made from a template states; its meals come from the cache. */
export interface PlanFromTemplateInput {
  templateId: string;
  /** The plan's first day, as a `LocalDate` key. */
  startDate: string;
  name?: string | null;
  servings?: number | null;
  budgetAmount?: number | null;
  dietaryProfileId?: string | null;
}

/** What a template cut from a plan states; its meals come from the cache. */
export interface TemplateFromPlanInput {
  mealPlanId: string;
  name: string;
  description?: string | null;
  category?: TemplateCategory | null;
  tags?: string[] | null;
}

export function useMealTemplateActions() {
  const client = useApolloClient();
  const { t } = useTranslation();
  const user = useUser();
  const { createMealPlan, creating: creatingPlan } = useMealPlanActions();

  const [createTemplateMutation, { loading: creatingTemplate }] = useMutation(
    CreateMealTemplateDocument,
    {
      context: { localFirst: true },
      update: (cache, { data }) => {
        const payload = appliedPayload(data);
        if (payload) {
          addToMealTemplates(cache, payload.mealTemplate, {
            position: 'start',
            // Scope the write to variants this template belongs to: the browser
            // sheet caches one `mealTemplates` entry per category/search the
            // user has visited, and cache.modify fans out across all of them.
            skipStoreField: skipUnmatchedFilterVariants({
              category: payload.mealTemplate.category,
            }),
          });
        }
      },
    },
  );

  const [createPlanItem, { loading: addingMeals }] = useMutation(
    CreateMealPlanItemDocument,
    { context: { localFirst: true } },
  );

  // The optimistic remove + revert live in deleteTemplate (local-first).
  const [deleteTemplateMutation] = useMutation(DeleteMealTemplateDocument, {
    context: { localFirst: true },
    update: (cache, { data }, { variables }) => {
      if (variables && appliedPayload(data))
        settleMealTemplateDelete(cache, variables, data);
    },
  });

  const reportSkipped = (count: number) => {
    if (count === 0) return;
    toastService.info(t('duplicatePlan.someSkipped', { count }));
  };

  /** `true` once the template landed or is queued; `false` when it reverted. */
  const createTemplate = async (
    input: CreateMealTemplateInput,
  ): Promise<boolean> => {
    // The minted id is the row's PK, so the replay converges on this row.
    const id = input.id ?? generateEntityId();
    const ownerId = user?.id;
    if (ownerId) {
      try {
        const template = writeLocalMealTemplate(
          client.cache,
          id,
          input,
          ownerId,
        );
        addToMealTemplates(client.cache, template, {
          position: 'start',
          skipStoreField: skipUnmatchedFilterVariants({
            category: template.category,
          }),
        });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Create Meal Template (optimistic)',
        });
      }
    }

    const revertCreate = () => {
      if (!ownerId) return;
      try {
        removeFromMealTemplates(client.cache, id, {
          evictItem: true,
        });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Meal Template create',
        });
      }
    };

    const settled = await settleMutation(
      () =>
        createTemplateMutation({
          variables: { input: { ...input, id } },
        }),
      {
        document: CreateMealTemplateDocument,
        fallback: t('mealTemplateBuilder.failedToCreate'),
        onFailed: revertCreate,
      },
    );
    return settled.status !== 'failed';
  };

  const createPlanFromTemplate = async (input: PlanFromTemplateInput) => {
    const template = readTemplateSource(client.cache, input.templateId);
    if (!template) {
      toastService.error(t('mealPlan.needsTheTemplate'));
      return null;
    }

    const derived = planFromTemplate(template, {
      startDate: input.startDate,
      name: input.name,
      servings: input.servings,
      budgetAmount: input.budgetAmount,
      dietaryProfileId: input.dietaryProfileId,
      planType: MealPlanType.Weekly,
    });

    const created = await createMealPlan(derived.plan);
    if (created.status === 'failed') return null;

    let failedMeal: SettledFailure | undefined;
    for (const meal of derived.items) {
      // Offline the new plan shows its meals only from this write.
      const revert = writeLocalMealPlanItem(client.cache, meal);
      const settled = await settleMutation(
        () =>
          createPlanItem({
            variables: { input: meal },
          }),
        {
          document: CreateMealPlanItemDocument,
          fallback: t('mealTemplateBuilder.failedToAddItem'),
          present: 'none',
          onFailed: revert,
        },
      );
      failedMeal = failedMeal ?? settled.failure;
    }

    // One message for the batch: the plan exists, so a meal that did not land
    // replaces the success toast rather than following it.
    if (failedMeal) {
      toastService.error(failedMeal.body);
    } else {
      toastService.success(t('mealTemplateActions.planCreated'));
    }
    reportSkipped(derived.skipped.length);
    Telemetry.trackEvent('meal_plan_created_from_template', {
      template_id: input.templateId,
      copied_meals: derived.items.length,
    });
    return { mealPlanId: derived.plan.id ?? null };
  };

  const createTemplateFromPlan = async (input: TemplateFromPlanInput) => {
    const plan = readPlanSource(client.cache, input.mealPlanId);
    if (!plan) {
      toastService.error(t('mealPlan.needsThePlan'));
      return null;
    }

    const derived = templateFromPlan(plan, {
      name: input.name,
      description: input.description,
      category: input.category,
      tags: input.tags,
    });

    if (!(await createTemplate(derived.template))) return null;
    toastService.success(t('mealTemplateActions.savedAsTemplate'));
    reportSkipped(derived.skipped.length);
    Telemetry.trackEvent('template_created_from_meal_plan', {
      meal_plan_id: input.mealPlanId,
      copied_meals: derived.template.items?.length ?? 0,
    });
    return { mealTemplateId: derived.template.id ?? null };
  };

  const deleteTemplate = async (id: string) => {
    // Snapshot first so a server rejection can restore the template card.
    const cacheId = client.cache.identify({ __typename: 'MealTemplate', id });
    const snapshot = cacheId
      ? client.cache.readFragment<MealTemplateDisplayFragment>({
          id: cacheId,
          fragment: MealTemplateDisplayFragmentDoc,
          fragmentName: 'MealTemplateDisplay',
        })
      : null;

    // Local-first: remove from the cache BEFORE firing, so the deletion shows
    // immediately and survives an offline queue. Replaying the delete for an
    // already-deleted template is idempotent on the API, and a NotFound counts
    // as deleted too. Mirrors deleteMealPlan.
    try {
      removeFromMealTemplates(client.cache, id, { evictItem: true });
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Delete Template (optimistic)',
      });
    }

    const restoreTemplate = () => {
      if (!snapshot || !cacheId) return;
      try {
        client.cache.writeFragment({
          id: cacheId,
          fragment: MealTemplateDisplayFragmentDoc,
          fragmentName: 'MealTemplateDisplay',
          data: snapshot,
        });
        addToMealTemplates(client.cache, snapshot, {
          position: 'start',
          skipStoreField: skipUnmatchedFilterVariants({
            category: snapshot.category,
          }),
        });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Restore refused Template delete',
        });
      }
    };

    const settled = await settleMutation(
      () =>
        deleteTemplateMutation({
          variables: { input: { id } },
        }),
      {
        document: DeleteMealTemplateDocument,
        fallback: t('mealTemplateActions.deleteFailed'),
        removal: true,
        onFailed: restoreTemplate,
      },
    );
    if (settled.status === 'failed') return false;

    // Applied (online) or queued (offline) — both keep the optimistic remove.
    toastService.success(t('mealTemplateActions.templateDeleted'));
    return true;
  };

  const duplicateTemplate = async (id: string, newName: string) => {
    const template = readTemplateSource(client.cache, id);
    if (!template) {
      toastService.error(t('mealPlan.needsTheTemplate'));
      return null;
    }

    const derived = deriveTemplateCopy(template, { newName });
    if (!(await createTemplate(derived.template))) return null;
    toastService.success(t('mealTemplateActions.templateDuplicated'));
    reportSkipped(derived.skipped.length);
    return { mealTemplateId: derived.template.id ?? null };
  };

  return {
    createPlanFromTemplate,
    createTemplateFromPlan,
    deleteTemplate,
    duplicateTemplate,
    creatingFromTemplate: creatingPlan || addingMeals,
    creatingTemplate,
    duplicating: creatingTemplate,
  };
}
