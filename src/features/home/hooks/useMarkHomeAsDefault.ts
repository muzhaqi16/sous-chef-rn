/**
 * The one hook that fires `MarkHomeAsDefault`, so every route that moves the
 * account default is local-first and writes `Home.isDefault`. Replay is safe:
 * marking the same home twice is idempotent.
 */
import { MarkHomeAsDefaultDocument } from '#operations/home/userSettings.generated';
import type { SettledFailure } from '#apollo/utils/settleMutation';
import { operationNameOf } from '#apollo/utils/documentOperation';
import { appliedPayload } from '#utils/errors/mutationPayload';
import { errorService } from '#services/errorService';
import { useTranslation } from '#i18n';
import type { MarkDefaultHomeInputs } from '#features/home/offline/localWrites';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { useDefaultHomeSyncStore } from '#features/home/store/useDefaultHomeSyncStore';
import { todayKey } from '#utils/dateUtils';

interface MarkHomeAsDefaultResult {
  /** `refused`: the server ruled against it. `failed`: it never ruled. */
  status: 'confirmed' | 'queued' | 'refused' | 'failed';
  serverPantry: { id: string } | null;
  /** The localized copy for a refused or failed write; the caller presents it. */
  failure?: SettledFailure;
}

export const useMarkHomeAsDefault = () => {
  const { t } = useTranslation();
  const markPending = useDefaultHomeSyncStore(state => state.markPending);
  const markConfirmed = useDefaultHomeSyncStore(state => state.markConfirmed);
  const clearPending = useDefaultHomeSyncStore(state => state.clearPending);

  const markDefault = useLocalWrite(MarkHomeAsDefaultDocument, {
    fallback: t('errors.setDefaultHomeFailed'),
    present: 'none',
  });

  const markAsDefault = async (
    homeId: string,
  ): Promise<MarkHomeAsDefaultResult> => {
    // Recorded even when the target is not cached, so a retry is not skipped
    // as already done.
    markPending(homeId);

    const inputs: MarkDefaultHomeInputs = { homeId };
    const settled = await markDefault.send(
      { input: { homeId }, today: todayKey() },
      inputs,
    );

    if (settled.failure) {
      // Here, not `onFailed`: refused with a home's create, this never settles.
      clearPending();
      // A refusal carries its member in `data`; settling reports only the
      // failures that never reached a ruling, and a lost default is silent.
      const refused = !!settled.data?.markHomeAsDefault;
      if (refused) {
        errorService.reportError(
          new Error(`Default home refused: ${settled.failure.code ?? ''}`),
          { operation: operationNameOf(MarkHomeAsDefaultDocument) },
        );
      }
      return {
        status: refused ? 'refused' : 'failed',
        serverPantry: null,
        failure: settled.failure,
      };
    }

    // Queued: the local write and the pending marker both stand until replay.
    if (settled.status === 'queued') {
      return { status: 'queued', serverPantry: null };
    }

    markConfirmed(homeId);

    const payload = appliedPayload(settled.data);
    const serverPantry = payload ? payload.defaultPantry ?? null : null;

    return { status: 'confirmed', serverPantry };
  };

  return { markAsDefault };
};
