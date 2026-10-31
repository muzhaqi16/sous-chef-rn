import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreateHomeDocument } from '#operations/home/home.generated';
import { holdsHomesList } from '#features/home/hooks/homeCacheUpdaters';
import type { CreateHomeInputs } from '#features/home/offline/localWrites';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { generateEntityId } from '#/utils/generateEntityId';
import { useUser } from '#store/useAppStore';
import type { CreateHomeInput } from '#/graphql/generated/schemaTypes';
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
    { context: { localFirst: true } },
  );

  /** `fallback` is the copy for a failure its code does not describe. */
  const createHome = async (
    fields: Omit<CreateHomeInput, 'id' | 'createDefaultPantry'>,
    fallback: string = t('errors.createHomeFailed'),
  ): Promise<CreateHomeOutcome> => {
    const id = generateEntityId();
    const input = { ...fields, id, createDefaultPantry: false };
    // Selecting the home opens its event subscriptions, which the server refuses
    // until the create lands — see `unconfirmedCreates`.
    unconfirmedCreates.mark(id);

    // `useDefaultHome` fires the app's only GetHomes fetch once per session,
    // and during onboarding that happens when the account has zero homes — so a
    // miss here leaves the new home out of an otherwise authoritative empty list.
    if (user && !holdsHomesList(client.cache)) onHomesCacheMiss?.();

    const inputs: CreateHomeInputs = {
      home: input,
      creator: user
        ? { id: user.id, email: user.email, displayName: user.displayName }
        : undefined,
      now: new Date().toISOString(),
    };
    const settled = await pendingWritesOf(client.cache).send(
      CreateHomeDocument,
      { input },
      write =>
        settleMutation(() => createHomeMutation(write), {
          document: CreateHomeDocument,
          fallback,
          present: 'none',
        }),
      inputs,
    );
    // Released on every outcome; a queued create is tracked by the offline
    // queue's pending set from here on.
    unconfirmedCreates.confirm(id);

    if (settled.failure) {
      return { status: 'rejected', id, failure: settled.failure };
    }
    return { status: 'ok', id };
  };

  return { createHome, creating };
}

/** The create this hook returns, for callers that pass it on. */
export type CreateHomeFn = ReturnType<typeof useCreateHome>['createHome'];
