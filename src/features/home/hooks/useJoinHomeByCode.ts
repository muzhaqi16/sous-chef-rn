import { useMutation, useQuery } from '@apollo/client/react';
import {
  GetHomeByJoinCodeDocument,
  JoinHomeByCodeDocument,
} from '#operations/home/home.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';

interface UseJoinHomeByCodeArgs {
  code: string;
  skip: boolean;
}

/** A join's verdict. `body` is localized copy, never the server's own. */
export type JoinHomeOutcome =
  | { joined: true; homeId: string }
  | { joined: false; body: string };

/** Preview the home a join code points at, then join it. */
export function useJoinHomeByCode({ code, skip }: UseJoinHomeByCodeArgs) {
  const { t } = useTranslation();
  const { data, loading } = useQuery(GetHomeByJoinCodeDocument, {
    variables: { joinCode: code },
    skip: !code || skip,
    fetchPolicy: 'cache-and-network',
  });

  const [joinMutation] = useMutation(JoinHomeByCodeDocument);

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
    if (payload) return { joined: true, homeId: payload.membership.homeId };
    return {
      joined: false,
      body: settled.failure?.body ?? t('joinHome.joinFailed'),
    };
  };

  return {
    home: data?.homeByJoinCode ?? null,
    previewLoading: loading,
    joinHome,
  };
}
