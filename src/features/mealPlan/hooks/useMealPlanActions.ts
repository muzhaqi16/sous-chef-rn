import { useApolloClient } from '@apollo/client/react';
import {
  CreateMealPlanDocument,
  UpdateMealPlanDocument,
  DeleteMealPlanDocument,
  GetMealPlansDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import type { CreatePlanInputs } from '#features/mealPlan/offline/localWrites';
import type {
  CreateMealPlanInput,
  UpdateMealPlanInput,
} from '#graphql/generated/schemaTypes';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { readVersion } from '#apollo/utils/entityWriteChain';
import type { SettledFailure } from '#apollo/utils/settleMutation';
import { generateEntityId } from '#utils/generateEntityId';
import { useUser } from '#store/useAppStore';
import { alertService } from '#services/alertService';
import { useTranslation } from '#i18n';

/** A plan create as its caller acts on it; `failure` is what to show. */
export type MealPlanCreateOutcome =
  | { status: 'applied' | 'queued' }
  | { status: 'failed'; failure: SettledFailure };

interface CreateMealPlanOptions {
  /** `'none'` leaves the failure to the caller, e.g. to show on a form field. */
  present?: 'alert' | 'none';
}

/** Fields an update can change that the plan's row shows. */
const shownPlanFields = (
  input: Omit<UpdateMealPlanInput, 'id' | 'version'>,
) => ({
  name: input.name ?? undefined,
  description: input.description,
  planType: input.planType ?? undefined,
  startDate: input.startDate ?? undefined,
  endDate: input.endDate ?? undefined,
  servings: input.servings ?? undefined,
  budgetAmount: input.budgetAmount,
  updatedAt: new Date().toISOString(),
});

export function useMealPlanActions() {
  const client = useApolloClient();
  const user = useUser();
  const { t } = useTranslation();

  const createPlan = useLocalWrite(CreateMealPlanDocument, {
    fallback: t('mealPlan.failedToCreate'),
  });

  // A save made elsewhere since is refused, not overwritten.
  const updatePlan = useLocalWrite(UpdateMealPlanDocument, {
    fallback: t('errors.saveFailed'),
    // A stale version means another member saved the plan since: show theirs.
    onVersionConflict: () => {
      void client.refetchQueries({
        include: ['GetMealPlan', GetMealPlansDocument],
      });
    },
  });

  const deletePlan = useLocalWrite(DeleteMealPlanDocument, {
    fallback: t('mealPlanMain.deleteMealPlanFailed'),
    removal: true,
  });

  const createMealPlan = async (
    input: CreateMealPlanInput,
    { present }: CreateMealPlanOptions = {},
  ): Promise<MealPlanCreateOutcome> => {
    // A caller deriving a plan mints it first, since its items name it as parent.
    const plan = { ...input, id: input.id ?? generateEntityId() };
    const inputs: CreatePlanInputs = {
      plan,
      creatorId: user?.id,
      now: new Date().toISOString(),
    };

    const settled = await createPlan.send({ input: plan }, inputs, {
      settle: { ...(present && { present }) },
    });

    if (settled.failure) return { status: 'failed', failure: settled.failure };
    return { status: settled.status === 'queued' ? 'queued' : 'applied' };
  };

  /** `true` once the change landed or is queued; `false` when it was refused. */
  const updateMealPlan = async (
    id: string,
    input: Omit<UpdateMealPlanInput, 'id' | 'version'>,
  ): Promise<boolean> => {
    const entity = { __typename: 'MealPlan', id };
    const version = readVersion(client.cache, entity);
    if (version === undefined) {
      alertService.alert(t('labels.error'), t('errors.saveFailed'));
      return false;
    }

    const settled = await updatePlan.sendFields({
      entity,
      fields: shownPlanFields(input),
      variables: { input: { ...input, id, version } },
    });
    return settled.status !== 'failed';
  };

  const deleteMealPlan = async (id: string) => {
    const settled = await deletePlan.send({ input: { id } });
    return settled.status !== 'failed';
  };

  return {
    createMealPlan,
    updateMealPlan,
    deleteMealPlan,
    creating: createPlan.sending,
    deleting: deletePlan.sending,
  };
}
