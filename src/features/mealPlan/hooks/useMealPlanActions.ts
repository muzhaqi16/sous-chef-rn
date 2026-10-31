import { useApolloClient, useMutation } from '@apollo/client/react';
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
} from '#/graphql/generated/schemaTypes';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import { readVersion } from '#/apollo/utils/entityWriteChain';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { generateEntityId } from '#/utils/generateEntityId';
import { useUser } from '#store/useAppStore';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';

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

  const [createMealPlanMutation, { loading: creating }] = useMutation(
    CreateMealPlanDocument,
    { context: { localFirst: true } },
  );

  const [updateMealPlanMutation] = useMutation(UpdateMealPlanDocument, {
    context: { localFirst: true },
  });

  const [deleteMealPlanMutation, { loading: deleting }] = useMutation(
    DeleteMealPlanDocument,
    { context: { localFirst: true } },
  );

  const createMealPlan = async (
    input: CreateMealPlanInput,
    { present }: CreateMealPlanOptions = {},
  ): Promise<MealPlanCreateOutcome> => {
    // A caller deriving a plan mints it first, since its items name it as parent.
    const plan = { ...input, id: input.id ?? generateEntityId() };
    // The local write publishes this id to every consumer, including the detail
    // query on MealPlanMain. Hold that query off until the server has a row to
    // answer with — see `unconfirmedCreates`.
    unconfirmedCreates.mark(plan.id);
    const inputs: CreatePlanInputs = {
      plan,
      creatorId: user?.id,
      now: new Date().toISOString(),
    };

    const settled = await pendingWritesOf(client.cache).send(
      CreateMealPlanDocument,
      { input: plan },
      write =>
        settleMutation(() => createMealPlanMutation(write), {
          document: CreateMealPlanDocument,
          fallback: t('mealPlan.failedToCreate'),
          present,
        }),
      inputs,
    );

    // Released on every outcome: acknowledged and rejected both leave nothing
    // for a detail read to miss, and a queued create has already been handed
    // off to `queueStore` by the time the mutation resolves.
    unconfirmedCreates.confirm(plan.id);

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

    // A stale version means another member saved the plan since: show theirs.
    const showServerPlan = () => {
      void client.refetchQueries({
        include: ['GetMealPlan', GetMealPlansDocument],
      });
    };
    // A save made elsewhere since is refused, not overwritten.
    const settled = await sendFields(client.cache, {
      entity,
      fields: shownPlanFields(input),
      variables: { input: { ...input, id, version } },
      mutate: updateMealPlanMutation,
      settle: {
        document: UpdateMealPlanDocument,
        fallback: t('errors.saveFailed'),
        onVersionConflict: showServerPlan,
      },
    });
    return settled.status !== 'failed';
  };

  const deleteMealPlan = async (id: string) => {
    const settled = await pendingWritesOf(client.cache).send(
      DeleteMealPlanDocument,
      { input: { id } },
      write =>
        settleMutation(() => deleteMealPlanMutation(write), {
          document: DeleteMealPlanDocument,
          fallback: t('mealPlanMain.deleteMealPlanFailed'),
          removal: true,
        }),
    );
    return settled.status !== 'failed';
  };

  return {
    createMealPlan,
    updateMealPlan,
    deleteMealPlan,
    creating,
    deleting,
  };
}
