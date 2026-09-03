import { useMutation, useQuery } from '@apollo/client/react';
import {
  GetHomeByJoinCodeDocument,
  JoinHomeByCodeDocument,
} from '#operations/home/home.generated';

interface UseJoinHomeByCodeArgs {
  code: string;
  skip: boolean;
}

/** Preview the home a join code points at, then join it. */
export function useJoinHomeByCode({ code, skip }: UseJoinHomeByCodeArgs) {
  const { data, loading } = useQuery(GetHomeByJoinCodeDocument, {
    variables: { joinCode: code },
    skip: !code || skip,
    fetchPolicy: 'cache-and-network',
  });

  const [joinMutation] = useMutation(JoinHomeByCodeDocument);

  const joinHome = async (joinCode: string) => {
    const { data: joinData } = await joinMutation({
      variables: { input: { joinCode } },
    });
    return joinData?.joinHomeByCode;
  };

  return {
    home: data?.homeByJoinCode ?? null,
    previewLoading: loading,
    joinHome,
  };
}
