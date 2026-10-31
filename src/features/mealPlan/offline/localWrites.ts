/**
 * What each meal plan and template write changes on the device, as a pending
 * layer. The server's answer writes its own rows; `commit` adds what it cannot
 * state.
 */
import type { OperationVariables } from '@apollo/client';
import type { LocalWrite } from '#/apollo/pendingWrites/types';
import {
  TemplateCategory,
  type AddTemplateItemInput,
  type CreateMealPlanInput,
  type CreateMealPlanItemInput,
  type CreateMealTemplateInput,
} from '#/graphql/generated/schemaTypes';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';
import {
  addToMealPlans,
  hideMealPlan,
  writeLocalMealPlan,
} from '#features/mealPlan/cache/mealPlan';
import {
  adoptServerMealPlanItem,
  hideMealPlanItem,
  removeFromMealPlanItems,
  showLocalMealPlanItem,
} from '#features/mealPlan/cache/mealPlanItem';
import {
  addToMealTemplates,
  hideMealTemplate,
  writeLocalMealTemplate,
} from '#features/mealPlan/cache/mealTemplate';
import {
  addTemplateItemToCache,
  hideTemplateItem,
  localTemplateItem,
  removeTemplateItemFromCache,
} from '#features/mealPlan/cache/mealTemplateItem';
import {
  removeFromMealPlans,
  removeFromMealTemplates,
} from '#features/mealPlan/cache/removals';

const idOf = (value: unknown): string | undefined =>
  isRecord(value) && typeof value.id === 'string' ? value.id : undefined;

/** The row a write names, from its variables. */
const subjectOf = (variables: OperationVariables): string | undefined =>
  idOf(variables.input);

export type CreatePlanInputs = {
  plan: CreateMealPlanInput & { id: string };
  creatorId?: string;
  now: string;
};

export const createPlan: LocalWrite<CreatePlanInputs> = {
  apply(cache, { inputs: { plan, creatorId, now } }) {
    if (!creatorId) return;
    const row = writeLocalMealPlan(cache, plan.id, plan, creatorId, now);
    addToMealPlans(cache, row, { position: 'start' });
  },
  commit(cache, { inputs: { plan } }) {
    addToMealPlans(
      cache,
      { __typename: 'MealPlan', id: plan.id },
      { position: 'start' },
    );
  },
};

export const removePlan: LocalWrite = {
  apply(cache, { variables }) {
    const id = subjectOf(variables);
    if (id) hideMealPlan(cache, id);
  },
  // The answer names the row, which puts it back in the server's data.
  commit(cache, { variables }) {
    const id = subjectOf(variables);
    if (id) removeFromMealPlans(cache, id, { evictItem: true });
  },
};

export type CreatePlanItemInputs = { item: CreateMealPlanItemInput };

export const createPlanItem: LocalWrite<CreatePlanItemInputs> = {
  apply(cache, { inputs: { item } }) {
    showLocalMealPlanItem(cache, item);
  },
  // A meal the plan already held on that day, slot and recipe answers its own id.
  commit(cache, { inputs: { item } }, data) {
    const payload: unknown = appliedPayload(data);
    const answered = idOf(isRecord(payload) ? payload.mealPlanItem : undefined);
    if (answered) {
      adoptServerMealPlanItem(cache, item.mealPlanId, answered, item.id);
    }
  },
};

export type RemovePlanItemInputs = { mealPlanId: string | null };

export const removePlanItem: LocalWrite<RemovePlanItemInputs> = {
  apply(cache, { variables, inputs: { mealPlanId } }) {
    const id = subjectOf(variables);
    if (id && mealPlanId) hideMealPlanItem(cache, mealPlanId, id);
  },
  // The answer names the row, which puts it back in the server's data.
  commit(cache, { variables, inputs: { mealPlanId } }) {
    const id = subjectOf(variables);
    if (id && mealPlanId) {
      removeFromMealPlanItems(cache, mealPlanId, id, { evictItem: true });
    }
  },
};

export type CreateTemplateInputs = {
  template: CreateMealTemplateInput & { id: string };
  ownerId?: string;
  now: string;
};

export const createTemplate: LocalWrite<CreateTemplateInputs> = {
  apply(cache, { inputs: { template, ownerId, now } }) {
    if (!ownerId) return;
    addToMealTemplates(
      cache,
      writeLocalMealTemplate(cache, template.id, template, ownerId, now),
    );
  },
  commit(cache, { inputs: { template } }) {
    addToMealTemplates(cache, {
      __typename: 'MealTemplate',
      id: template.id,
      category: template.category ?? TemplateCategory.Custom,
    });
  },
};

export const removeTemplate: LocalWrite = {
  apply(cache, { variables }) {
    const id = subjectOf(variables);
    if (id) hideMealTemplate(cache, id);
  },
  // The answer names the row, which puts it back in the server's data.
  commit(cache, { variables }) {
    const id = subjectOf(variables);
    if (id) removeFromMealTemplates(cache, id, { evictItem: true });
  },
};

export type AddTemplateItemInputs = {
  item: AddTemplateItemInput & { id: string };
};

const showTemplateItem: LocalWrite<AddTemplateItemInputs>['apply'] = (
  cache,
  { inputs: { item } },
) => {
  addTemplateItemToCache(
    cache,
    item.templateId,
    localTemplateItem(cache, item.id, item),
  );
};

export const addTemplateItem: LocalWrite<AddTemplateItemInputs> = {
  apply: showTemplateItem,
  // Its answer states the template alone, so the row and its edge are written.
  commit: showTemplateItem,
};

export type RemoveTemplateItemInputs = { templateId: string };

export const removeTemplateItem: LocalWrite<RemoveTemplateItemInputs> = {
  apply(cache, { variables, inputs: { templateId } }) {
    const id = subjectOf(variables);
    if (id) hideTemplateItem(cache, templateId, id);
  },
  // The answer names the row, which puts it back in the server's data.
  commit(cache, { variables, inputs: { templateId } }) {
    const id = subjectOf(variables);
    if (id) removeTemplateItemFromCache(cache, templateId, id);
  },
};
