import type { CreateTemplateInputs } from '#features/mealPlan/offline/localWrites';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import type { CreateMealTemplateInput } from '#graphql/generated/schemaTypes';
import { useTranslation } from '#i18n';
import { useUser } from '#store/useAppStore';
import { generateEntityId } from '#utils/generateEntityId';
import { createMealTemplateWrite } from '#features/mealPlan/offline/localWrites';

/**
 * The one template create. Its minted id is the row's PK, so a replay converges
 * on it. Answers that id once the template landed or is queued, else null.
 */
export function useCreateMealTemplate() {
  const { t } = useTranslation();
  const user = useUser();
  const create = useLocalWrite(createMealTemplateWrite, {
    fallback: t('mealTemplateBuilder.failedToCreate'),
  });

  const createTemplate = async (
    input: CreateMealTemplateInput,
  ): Promise<string | null> => {
    const template = { ...input, id: input.id ?? generateEntityId() };
    const inputs: CreateTemplateInputs = {
      template,
      ownerId: user?.id,
      now: new Date().toISOString(),
    };
    const settled = await create.send({ input: template }, inputs);
    return settled.status === 'failed' ? null : template.id;
  };

  return { createTemplate, creating: create.sending };
}
