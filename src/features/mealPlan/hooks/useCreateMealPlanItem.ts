import type { CreatePlanItemInputs } from '#features/mealPlan/offline/localWrites';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import type { CreateMealPlanItemInput } from '#graphql/generated/schemaTypes';
import { useTranslation } from '#i18n';
import { createMealPlanItemWrite } from '#features/mealPlan/offline/localWrites';

/**
 * The one meal create. Its minted id is the row's PK, so a replay converges on
 * it. A meal added alone shows its refusal; a batch reports one for all.
 */
export function useCreateMealPlanItem() {
  const { t } = useTranslation();
  const create = useLocalWrite(createMealPlanItemWrite, {
    fallback: t('mealTemplateBuilder.failedToAddItem'),
  });

  const sendItem = (
    item: CreateMealPlanItemInput,
    present: 'toast' | 'none',
  ) => {
    const inputs: CreatePlanItemInputs = { item };
    return create.send({ input: item }, inputs, { settle: { present } });
  };

  return { sendItem, creating: create.sending };
}
