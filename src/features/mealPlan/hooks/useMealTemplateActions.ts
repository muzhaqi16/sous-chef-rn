import { useApolloClient, useMutation } from '@apollo/client/react';
import { DeleteMealTemplateDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import { planFromTemplate } from '#features/mealPlan/utils/planFromTemplate';
import { templateFromPlan } from '#features/mealPlan/utils/templateFromPlan';
import { duplicateTemplate as deriveTemplateCopy } from '#features/mealPlan/utils/duplicateTemplate';
import { useCreateMealPlanItem } from '#features/mealPlan/hooks/useCreateMealPlanItem';
import { useCreateMealTemplate } from '#features/mealPlan/hooks/useCreateMealTemplate';
import { useMealPlanActions } from '#features/mealPlan/hooks/useMealPlanActions';
import {
  MealPlanType,
  type TemplateCategory,
} from '#/graphql/generated/schemaTypes';
import {
  readPlanSource,
  readTemplateSource,
} from '#features/mealPlan/cache/derivationSources';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';

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
  const { createMealPlan, creating: creatingPlan } = useMealPlanActions();
  const { createTemplate, creating: creatingTemplate } =
    useCreateMealTemplate();
  const { sendItem, creating: addingMeals } = useCreateMealPlanItem();

  const [deleteTemplateMutation] = useMutation(DeleteMealTemplateDocument, {
    context: { localFirst: true },
  });

  const reportSkipped = (count: number) => {
    if (count === 0) return;
    toastService.info(t('duplicatePlan.someSkipped', { count }));
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
      const settled = await sendItem(meal, 'none');
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
    const settled = await pendingWritesOf(client.cache).send(
      DeleteMealTemplateDocument,
      { input: { id } },
      write =>
        settleMutation(() => deleteTemplateMutation(write), {
          document: DeleteMealTemplateDocument,
          fallback: t('mealTemplateActions.deleteFailed'),
          removal: true,
        }),
    );
    if (settled.status === 'failed') return false;

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
