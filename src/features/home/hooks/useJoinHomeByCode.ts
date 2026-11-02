import {
  skipToken,
  useApolloClient,
  useMutation,
  useQuery,
} from '@apollo/client/react';
import {
  GetHomesDocument,
  JoinHomeByCodeDocument,
  ResolveShareLinkDocument,
} from '#operations/home/home.generated';
import { homeLink } from '#features/home/utils/shareLink';
import { usePreservedQueryData } from '#hooks/apollo/usePreservedQueryData';
import { useDataState } from '#hooks/data/useDataState';
import { errorService } from '#/services/errorService';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';
import { addToHomesCache } from '#features/home/hooks/homeCacheUpdaters';

interface UseJoinHomeByCodeArgs {
  code: string;
  skip: boolean;
}

/**
 * A join's verdict. `homeKnown` says the joined home is in the cached homes
 * list, so selecting it cannot read as a home the user has left. `body` is
 * localized copy, never the server's own.
 */
export type JoinHomeOutcome =
  | { joined: true; homeId: string; homeKnown: boolean }
  | { joined: false; body: string };

/** Preview the home a join code points at, then join it. */
export function useJoinHomeByCode({ code, skip }: UseJoinHomeByCodeArgs) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const asked = !!code && !skip;
  // The pre-join preview: `homeByJoinCode` serves a whole Home whose
  // connections a non-member may not read, so its answer nulls for them.
  const { data, loading, error, refetch } = useQuery(
    ResolveShareLinkDocument,
    asked ? { variables: { code }, refetchOn: false } : skipToken,
  );
  // A null link is the server's "no match"; a failed read is `undefined`.
  const held = usePreservedQueryData(data, undefined, code);
  const home = homeLink(held?.resolveShareLink);
  const previewState = useDataState({
    loading,
    error,
    hasResult: held !== undefined,
    isEmpty: !home,
    skipped: !asked,
  });

  const [joinMutation] = useMutation(JoinHomeByCodeDocument, {
    update: (cache, { data }) => {
      const joined = appliedPayload(data)?.home;
      // Idempotent by id, and in the same step as the result: nothing selects
      // the joined home before the list has it.
      if (joined) addToHomesCache(cache, joined, { position: 'end' });
    },
  });

  const joinHome = async (joinCode: string): Promise<JoinHomeOutcome> => {
    const settled = await settleMutation(
      () => joinMutation({ variables: { input: { joinCode } } }),
      {
        document: JoinHomeByCodeDocument,
        fallback: t('joinHome.joinFailed'),
        present: 'none',
      },
    );
    const payload = appliedPayload(settled.data);
    if (payload) {
      const { homeId } = payload.membership;
      return {
        joined: true,
        homeId,
        homeKnown: payload.home != null || (await loadHomes()),
      };
    }
    return {
      joined: false,
      body: settled.failure?.body ?? t('joinHome.joinFailed'),
    };
  };

  /**
   * The answer carried no home, so the list is read instead. A query, not
   * `refetchQueries`: that re-runs only a list someone is watching.
   */
  async function loadHomes(): Promise<boolean> {
    // `errorPolicy: 'all'` resolves a failed read with `error`, not a throw.
    const { data, error } = await client
      .query({ query: GetHomesDocument, fetchPolicy: 'network-only' })
      .catch((thrown: unknown) => ({ data: undefined, error: thrown }));
    if (error) {
      errorService.reportError(error, {
        operation: 'JoinHomeByCode.refetchHomes',
      });
    }
    return !error && data != null;
  }

  return {
    home,
    previewLoading: loading,
    previewState,
    retryPreview: () => {
      void refetch();
    },
    joinHome,
  };
}
