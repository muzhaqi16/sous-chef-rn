import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreateHomeDocument } from '#operations/home/home.generated';
import {
  adoptServerMembership,
  buildOptimisticHome,
  revertOptimisticHome,
  writeOptimisticHome,
} from '#features/home/cache/optimisticHome';
import { addToHomesCache } from '#features/home/hooks/homeCacheUpdaters';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { generateEntityId } from '#/utils/generateEntityId';
import { useUser } from '#store/useAppStore';
import type { CreateHomeInput } from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';

/** A create's verdict, plus the id it minted — the home's id, queued or not. */
export type CreateHomeOutcome =
  | { status: 'ok'; id: string }
  /** `failure` is localized copy the caller presents; never the server's `message`. */
  | { status: 'rejected'; id: string; failure: SettledFailure };

/**
 * The one home create. Local-first: the home, the creator's Owner membership
 * and the homes-list edge are written under a minted id before firing.
 * `createDefaultPantry` is forced OFF — a server-minted pantry id is one no
 * offline pantry write could name as its parent.
 */
export function useCreateHome(onHomesCacheMiss?: () => void) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const user = useUser();
  const [createHomeMutation, { loading: creating }] = useMutation(
    CreateHomeDocument,
    {
      update: (cache, { data }) => {
        // The queue answers a queued create with a null payload, which the
        // schema's non-null result type does not admit.
        const payload = appliedPayload(data);
        if (!payload) return;
        // Idempotent by home id: the pre-fire write already inserted this one,
        // so the server row confirms it rather than duplicating it.
        addToHomesCache(cache, payload.home, { position: 'end' });
        // The membership is the one row the client could not key, so the
        // server's replaces the placeholder. Offline this same step runs from
        // the queue's replay reconciler instead.
        if (payload.home.myMembership) {
          adoptServerMembership(
            cache,
            payload.home.id,
            payload.home.myMembership.id,
          );
        }
      },
    },
  );

  /** `fallback` is the copy for a failure its code does not describe. */
  const createHome = async (
    fields: Omit<CreateHomeInput, 'id' | 'createDefaultPantry'>,
    fallback: string = t('errors.createHomeFailed'),
  ): Promise<CreateHomeOutcome> => {
    const id = generateEntityId();
    const input = { ...fields, id, createDefaultPantry: false };

    // Without an auth identity there is no membership to materialize, so the
    // create falls back to online-only rather than writing a home nobody owns.
    // Assigned in the try and read outside it: an optional call is a value
    // block, which bails the whole hook out of the React Compiler.
    let linked = true;
    if (user) {
      try {
        linked = writeOptimisticHome(
          client.cache,
          buildOptimisticHome(id, input, user),
        );
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Create Home (optimistic)',
        });
      }
    }
    // `useDefaultHome` fires the app's only GetHomes fetch once per session,
    // and during onboarding that happens when the account has zero homes — so a
    // miss here leaves the new home out of an otherwise authoritative empty list.
    if (!linked) onHomesCacheMiss?.();

    const revert = () => {
      if (!user) return;
      try {
        revertOptimisticHome(client.cache, id);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Home create',
        });
      }
    };

    const settled = await settleMutation(
      () =>
        createHomeMutation({
          variables: { input },
          context: { localFirst: true },
        }),
      {
        document: CreateHomeDocument,
        fallback,
        onFailed: revert,
        present: 'none',
      },
    );

    if (settled.failure) {
      return { status: 'rejected', id, failure: settled.failure };
    }
    return { status: 'ok', id };
  };

  return { createHome, creating };
}

/** The create this hook returns, for callers that pass it on. */
export type CreateHomeFn = ReturnType<typeof useCreateHome>['createHome'];
