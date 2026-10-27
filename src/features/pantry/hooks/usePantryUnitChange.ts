/**
 * Moves a stack onto another tracking unit: preview what the change would do,
 * then send it with the preview's `version`. Online only — the confirmation
 * shows the server's figures, so there is nothing to queue.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import type { PantryUnitChangeResolution } from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { isVersionConflictCode } from '#/utils/errors/versionConflict';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { writeRestatedBatches } from '#features/pantry/cache/restatedStack';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import {
  ChangePantryItemUnitDocument,
  PreviewPantryItemUnitChangeDocument,
  type PreviewPantryItemUnitChangeQuery,
} from './usePantryUnitChange.generated';
import { todayKey } from '#/utils/dateUtils';

export type UnitChangePreview =
  PreviewPantryItemUnitChangeQuery['previewPantryItemUnitChange'];

export interface UnitChangeRequest {
  pantryItemId: string;
  unitId: string;
  resolution?: PantryUnitChangeResolution;
  /** What the stack holds in the new unit; read with RECOUNT or no route. */
  quantity?: number;
  /** One new unit's size, when a measure becomes a count. */
  packageSize?: { netWeight: number; netWeightUnitId: string };
}

export type PreviewOutcome =
  | { status: 'ready'; preview: UnitChangePreview }
  | { status: 'offline' }
  | { status: 'failed' };

export type ChangeOutcome =
  | { status: 'changed' }
  | { status: 'conflict' }
  | { status: 'failed'; field: string | null; message: string };

export function usePantryUnitChange() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const isApiUnavailable = useIsApiUnavailable();
  const [changeMutation] = useMutation(ChangePantryItemUnitDocument, {
    update(cache, { data }, { variables }) {
      const changed = appliedPayload(data);
      if (!changed || !variables) return;
      writeRestatedBatches(
        cache,
        variables.input.pantryItemId,
        changed.batchesConnection,
      );
    },
  });

  const preview = async (
    request: UnitChangeRequest,
  ): Promise<PreviewOutcome> => {
    if (isApiUnavailable) return { status: 'offline' };
    const result = await client
      .query({
        query: PreviewPantryItemUnitChangeDocument,
        variables: { input: request },
        fetchPolicy: 'no-cache',
      })
      .catch((error: unknown) => {
        errorService.reportError(error, { operation: 'Preview unit change' });
        return null;
      });
    const next = result?.data?.previewPantryItemUnitChange;
    return next ? { status: 'ready', preview: next } : { status: 'failed' };
  };

  const change = async (
    request: UnitChangeRequest & { version: number },
  ): Promise<ChangeOutcome> => {
    const settled = await settleMutation(
      () =>
        changeMutation({ variables: { input: request, today: todayKey() } }),
      {
        document: ChangePantryItemUnitDocument,
        fallback: t('unitChange.failed'),
        present: 'none',
      },
    );
    if (settled.status !== 'failed') return { status: 'changed' };
    const failure = settled.failure;
    if (isVersionConflictCode(failure?.code)) {
      return { status: 'conflict' };
    }
    return {
      status: 'failed',
      field: failure?.field ?? null,
      message: failure?.body ?? t('unitChange.failed'),
    };
  };

  return { preview, change };
}
