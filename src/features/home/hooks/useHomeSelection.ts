/**
 * useHomeSelection — switching which home is active.
 *
 * **Two different things are called "the default home", and this hook is where
 * they meet.** Keeping them apart is the point:
 *
 * - The **selection** (`selectedHomeId`, Zustand + MMKV) is device-local: which
 *   home the user is looking at right now. It survives a restart on THIS
 *   device only.
 * - The **account default** (`Home.isDefault`, computed by the server from
 *   `UserSettings.defaultHomeId`, surfaced here as `remoteDefaultHomeId`) is
 *   shared across devices and is what a fresh install opens to.
 *
 * They are allowed to differ, and `isSynced` reports when they do. Exposing the
 * selection under a name like `defaultHome`/`defaultHomeId` is what let the
 * "Default" chip claim one home while the server said another, so this hook
 * names the selection `selectedHome`/`selectedHomeId` and nothing else.
 *
 * `setDefaultHome` deliberately moves BOTH: making a home the account default
 * also switches you to it, which is the behaviour the UI promises.
 *
 * Auto-selecting a first home is NOT here — see `useDefaultHome`.
 */

import { alertService } from '#/services/alertService';
import { t } from '#/i18n';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { MarkHomeAsDefaultDocument } from '#operations/home/userSettings.generated';
import {
  GetHomesDocument,
  type GetHomesQuery,
} from '#operations/home/home.generated';
import type { ApolloCache, Reference } from '@apollo/client';
import { extractNodes } from '#/utils/connectionUtils';
import { defaultPantryOf } from '#features/home/utils/homePantries';
import { localizedRefusalMessage } from '#/apollo/utils/alertRejectedMutation';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import {
  useHomeState,
  useSelectedHomeId,
  useSelectedPantryId,
  useSetHomeAndPantry,
  useSetIsHomeSelectionReady,
  useSetSelectedPantryId,
} from '#store/useAppStore';

/**
 * Home node as returned by `GetHomes` (via `extractNodes`), widened with an
 * optional flat `pantries` array for legacy callers that pass the pre-connection
 * shape. Pantry lookups read either `pantries` or `pantriesConnection`.
 */
type HomeNode = GetHomesQuery['homes']['edges'][number]['node'] & {
  pantries?: Array<{ id: string; isDefault?: boolean }>;
};

/**
 * Cached `homes` connection edge. May be a normalized `{ node: Reference }`
 * wrapper or, defensively, a bare `Reference` in older persisted shapes.
 */
type HomeEdge = { node?: Reference } | Reference;

/**
 * Flip `isDefault` across every cached home so the badge (and every other
 * `isDefault` reader) moves immediately and STAYS moved while the mutation is
 * queued. Written directly rather than through an `optimisticResponse` because
 * an optimistic layer is torn down on completion — including the offline
 * queue's null completion.
 */
const applyDefaultHome = (cache: ApolloCache, defaultHomeId: string | null) => {
  cache.modify({
    fields: {
      homes(
        existingHomes: { edges?: HomeEdge[]; readonly __ref?: string },
        { readField },
      ) {
        if (!existingHomes || !existingHomes.edges) return existingHomes;

        existingHomes.edges.forEach((edge: HomeEdge) => {
          const homeRef = ('node' in edge && edge.node) || edge;
          if (!homeRef) return;

          const homeId = readField('id', homeRef);
          const cacheId = cache.identify(homeRef);
          if (cacheId) {
            cache.modify({
              id: cacheId,
              fields: { isDefault: () => homeId === defaultHomeId },
            });
          }
        });

        // Entities were modified directly; the connection itself is unchanged.
        return existingHomes;
      },
    },
  });
};

interface UseHomeSelectionOptions {
  homes: HomeNode[] | null;
  remoteDefaultHomeId: string | null;
}

/**
 * Hook for managing home selection and default home logic
 *
 * Handles:
 * - Auto-selection for first-time users
 * - Syncing default home to server
 * - Switching between homes with pantry coordination
 *
 * @example
 * ```tsx
 * const { selectedHomeId, setDefaultHome, defaultHome, isSynced } = useHomeSelection({
 *   homes,
 *   remoteDefaultHomeId,
 * });
 * ```
 */
export function useHomeSelection({
  homes,
  remoteDefaultHomeId,
}: UseHomeSelectionOptions) {
  const selectedHomeId = useSelectedHomeId();
  const { setSelectedHomeId } = useHomeState();
  const selectedPantryId = useSelectedPantryId();
  const setSelectedPantryId = useSetSelectedPantryId();
  const setHomeAndPantry = useSetHomeAndPantry();
  const setIsHomeSelectionReady = useSetIsHomeSelectionReady();

  const client = useApolloClient();

  // Local-first: the write lands in the cache permanently BEFORE firing (see
  // `applyDefaultHome` below), so `queueLink` can queue it offline and replay
  // it on reconnect instead of failing fast. That opt-in rules out an
  // `optimisticResponse` — Apollo tears the optimistic layer down when the
  // mutation "completes", and offline that completion is the queue's own null
  // result, so the badge would snap back while the write is still queued.
  //
  // Replay is safe without a `Sync*` mapping: `convertToSyncMutation` falls
  // back to re-sending the original, and marking the same home default twice
  // is idempotent.
  const [setDefaultHomeMutation] = useMutation(MarkHomeAsDefaultDocument, {
    context: { localFirst: true },
  });

  // Auto-selecting a first home lives in `useDefaultHome`, which
  // `AuthenticatedDataProvider` mounts for the whole authenticated app — and
  // this hook is reachable only from `HomeManagement`, inside it. A second
  // copy here fired the same `MarkHomeAsDefault` with different side effects:
  // it bypassed `setDefaultHome`, so it neither gated the pantry queries nor
  // adopted the pantry the server returns, leaving the two routes to disagree
  // about the selection depending on which won.

  /**
   * Make `homeId` the account default AND switch the current selection to it.
   *
   * Returns true when the change stands — the server accepted it, or the write
   * is queued offline and will replay. False means it was rolled back.
   */
  const setDefaultHome = async (homeId: string) => {
    // Already both the selection and the account default — nothing to move.
    if (homeId === selectedHomeId && homeId === remoteDefaultHomeId) {
      return true;
    }

    // Validate homeId exists
    if (!homeId) {
      alertService.alert(t('labels.error'), t('home.invalidHomeId'));
      return false;
    }

    // Resolve the target home BEST-EFFORT — for the pantry hint, nothing more.
    //
    // The local list is NOT an authority on existence. A mutation's
    // `onCompleted` runs in the same task as its cache write, BEFORE React
    // re-renders, so for a home created moments ago the `homes` PROP is still
    // the pre-create list — empty, for a user's first home. On the join path
    // the home is in neither the prop nor the cache: `JoinHomeByCode` returns
    // Membership only, and its `update` fires an un-awaited refetch. A miss
    // here therefore means "not visible yet", never "does not exist" — so it
    // must not abort the switch.
    //
    // The SERVER decides whether the home exists; a refusal is surfaced below.
    const homeFromProps = homes?.find(home => home.id === homeId);
    const cachedHomes = homeFromProps
      ? null
      : client.cache.readQuery({ query: GetHomesDocument });
    const targetHome =
      homeFromProps ??
      extractNodes(cachedHomes?.homes).find(home => home.id === homeId);

    // A hint for the optimistic switch; the server's `defaultPantry` wins below.
    const localDefaultPantry = defaultPantryOf(targetHome);

    // Store old values for potential rollback
    const previousHomeId = selectedHomeId;
    const previousPantryId = selectedPantryId;
    const previousDefaultHomeId = remoteDefaultHomeId;

    // 1. Gate all pantry queries by setting ready flag to false
    // This prevents GetPantry from firing with invalid id during the transition
    setIsHomeSelectionReady(false);

    // 2. Write the change permanently, then update the selection. Order
    // matters: the cache write is what survives being queued offline.
    applyDefaultHome(client.cache, homeId);
    setHomeAndPantry(homeId, localDefaultPantry?.id ?? null);

    let result;
    try {
      result = await setDefaultHomeMutation({
        variables: { input: { homeId } },
      });
    } catch {
      // A genuine throw. This mutation carries no mutation-level `onError`, so
      // nothing else reports it.
      applyDefaultHome(client.cache, previousDefaultHomeId);
      setHomeAndPantry(previousHomeId, previousPantryId);
      setIsHomeSelectionReady(true);
      alertService.alert(t('labels.error'), t('errors.setDefaultHomeFailed'));
      return false;
    }

    // The server is the authority on whether this home exists, but only when it
    // answered: a queued write (offline, or the API unreachable) resolves with
    // no payload and no error, and must keep the local change rather than
    // reverting it — it replays on reconnect.
    if (classifyCreateResult(result) === 'rejected') {
      applyDefaultHome(client.cache, previousDefaultHomeId);
      setHomeAndPantry(previousHomeId, previousPantryId);
      setIsHomeSelectionReady(true);
      alertService.alert(
        t('labels.error'),
        localizedRefusalMessage(
          result.data?.markHomeAsDefault,
          t('errors.setDefaultHomeFailed'),
        ),
      );
      return false;
    }

    // Adopt the pantry the server picked; it is the authority when it answered.
    if (
      result.data?.markHomeAsDefault?.__typename === 'MarkHomeAsDefaultPayload'
    ) {
      const serverPantry = result.data.markHomeAsDefault.defaultPantry;
      if (serverPantry?.id) {
        setSelectedPantryId(serverPantry.id);
      }
    }

    // 3. Re-enable queries now that the selection is settled.
    setIsHomeSelectionReady(true);
    return true;
  };

  // The home the user is currently VIEWING. Deliberately not called
  // `defaultHome`: it tracks `selectedHomeId`, which is a local, persisted
  // selection and is allowed to differ from the account's default — `isSynced`
  // is what reports that divergence.
  const selectedHome = homes?.find(home => home.id === selectedHomeId) || null;
  const isSynced = selectedHomeId === remoteDefaultHomeId;

  return {
    selectedHomeId,
    selectedHome,
    isSynced,
    setDefaultHome,
    setDefaultHomeMutation,
    setSelectedHomeId,
    setSelectedPantryId,
  };
}
