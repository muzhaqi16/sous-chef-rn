/**
 * Moves a stack onto another tracking unit: preview what the change would do,
 * then send it with the preview's `version`. Online only — the confirmation
 * shows the server's figures, so there is nothing to queue.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import type { PantryUnitChangeResolution } from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { VERSION_CONFLICT_CODES } from '#/utils/errors/versionConflict';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import {
  GetPantryItemBatchesDocument,
  GetPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  ChangePantryItemUnitDocument,
  PreviewPantryItemUnitChangeDocument,
  type PreviewPantryItemUnitChangeQuery,
} from './usePantryUnitChange.generated';

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
  const [changeMutation] = useMutation(ChangePantryItemUnitDocument);

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
      () => changeMutation({ variables: { input: request } }),
      {
        document: ChangePantryItemUnitDocument,
        fallback: t('unitChange.failed'),
        present: 'none',
      },
    );
    if (settled.status !== 'failed') {
      // Every batch is restated in the new unit; the response carries none.
      void client.refetchQueries({
        include: [GetPantryItemDocument, GetPantryItemBatchesDocument],
      });
      return { status: 'changed' };
    }
    const failure = settled.failure;
    if (failure?.code && VERSION_CONFLICT_CODES.includes(failure.code)) {
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
