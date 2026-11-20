import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreateMealPlanItemDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import type { CreatePlanItemInputs } from '#features/mealPlan/offline/localWrites';
import { sendLocalWrite } from '#/apollo/pendingWrites/useLocalWrite';
import type { CreateMealPlanItemInput } from '#/graphql/generated/schemaTypes';
import { useTranslation } from '#/i18n';

/**
 * The one meal create. Its minted id is the row's PK, so a replay converges on
 * it. A meal added alone shows its refusal; a batch reports one for all.
 */
export function useCreateMealPlanItem() {
  const client = useApolloClient();
  const { t } = useTranslation();
  const [createItem, { loading: creating }] = useMutation(
    CreateMealPlanItemDocument,
    { context: { localFirst: true } },
  );

  const sendItem = (
    item: CreateMealPlanItemInput,
    present: 'toast' | 'none',
  ) => {
    const inputs: CreatePlanItemInputs = { item };
    return sendLocalWrite(
      client.cache,
      CreateMealPlanItemDocument,
      { input: item },
      createItem,
      { fallback: t('mealTemplateBuilder.failedToAddItem'), present },
      inputs,
    );
  };

  return { sendItem, creating };
}
