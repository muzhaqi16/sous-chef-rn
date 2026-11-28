import type { CreatePantryInputs } from '#features/pantry/offline/localWrites';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import type { SettledFailure } from '#apollo/utils/settleMutation';
import { generateEntityId } from '#utils/generateEntityId';
import type { CreatePantryInput } from '#graphql/generated/schemaTypes';
import { useTranslation } from '#i18n';
import { todayKey } from '#utils/dateUtils';
import { createPantryWrite } from '#features/pantry/offline/localWrites';

/** A write's verdict. A refusal carries the localized copy the caller shows. */
export interface PantryWriteOutcome {
  status: 'ok' | 'rejected';
  failure?: SettledFailure;
}

/** A create also hands back the id it minted — the row's id, queued or not. */
export interface CreatePantryOutcome extends PantryWriteOutcome {
  id: string;
  /** The raw write, for a caller still reading refusals itself. */
  result: { data?: unknown; error?: unknown };
}

/**
 * The one pantry create. Local-first: the pantry shows complete under a
 * client-minted id, so a home created offline has a pantry every later write
 * can name as its parent. Public because onboarding and the
 * settings screen both create one before any pantry screen mounts. Presents
 * nothing: each caller decides whether a refusal is worth a message.
 */
export function useCreatePantry() {
  const { t } = useTranslation();
  const createPantry = useLocalWrite(createPantryWrite, {
    fallback: t('errors.createPantryFailed'),
    present: 'none',
  });

  const create = async (
    fields: Omit<CreatePantryInput, 'id'>,
  ): Promise<CreatePantryOutcome> => {
    const id = generateEntityId();
    const input = { ...fields, id };
    const today = todayKey();
    const inputs: CreatePantryInputs = { pantry: input, today };

    let result: CreatePantryOutcome['result'] = {};
    const settled = await createPantry.send({ input, today }, inputs, {
      run: async (mutate, write) => {
        const answer = await mutate(write);
        result = answer;
        return answer;
      },
    });
    if (settled.status === 'failed') {
      return { status: 'rejected', failure: settled.failure, result, id };
    }
    return { status: 'ok', result, id };
  };

  return { createPantry: create, creating: createPantry.sending };
}

/** The mutate function `useCreatePantry` returns, for callers that pass it on. */
export type CreatePantryFn = ReturnType<typeof useCreatePantry>['createPantry'];
