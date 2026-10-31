import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreateMealTemplateDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import type { CreateTemplateInputs } from '#features/mealPlan/offline/localWrites';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import type { CreateMealTemplateInput } from '#/graphql/generated/schemaTypes';
import { useTranslation } from '#/i18n';
import { useUser } from '#store/useAppStore';
import { generateEntityId } from '#/utils/generateEntityId';

/**
 * The one template create. Its minted id is the row's PK, so a replay converges
 * on it. Answers that id once the template landed or is queued, else null.
 */
export function useCreateMealTemplate() {
  const client = useApolloClient();
  const { t } = useTranslation();
  const user = useUser();
  const [createMutation, { loading: creating }] = useMutation(
    CreateMealTemplateDocument,
    { context: { localFirst: true } },
  );

  const createTemplate = async (
    input: CreateMealTemplateInput,
  ): Promise<string | null> => {
    const template = { ...input, id: input.id ?? generateEntityId() };
    const inputs: CreateTemplateInputs = {
      template,
      ownerId: user?.id,
      now: new Date().toISOString(),
    };
    const settled = await pendingWritesOf(client.cache).send(
      CreateMealTemplateDocument,
      { input: template },
      write =>
        settleMutation(() => createMutation(write), {
          document: CreateMealTemplateDocument,
          fallback: t('mealTemplateBuilder.failedToCreate'),
        }),
      inputs,
    );
    return settled.status === 'failed' ? null : template.id;
  };

  return { createTemplate, creating };
}
