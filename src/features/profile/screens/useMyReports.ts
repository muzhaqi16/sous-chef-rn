import { useQuery } from '@apollo/client/react';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import { useDataState } from '#hooks/data/useDataState';
import {
  MyUserReportsDocument,
  type MyUserReportsQuery,
} from './useMyReports.generated';

const PAGE_SIZE = 20;

/** A report as the list holds it: the row reads its own fragment off this ref. */
export type MyReportNode =
  MyUserReportsQuery['myUserReports']['edges'][number]['node'];

/** The reports the signed-in person has made, newest first, a page at a time. */
export function useMyReports() {
  const { data, loading, error, refetch, fetchMore } = useQuery(
    MyUserReportsDocument,
    { variables: { first: PAGE_SIZE } },
  );

  const connection = useConnectionData({
    data,
    selector: result => result.myUserReports,
    key: 'MyUserReports',
    loading,
    fetchMore,
    refetch,
  });

  const state = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: connection.items.length === 0,
  });

  return {
    reports: connection.items,
    state,
    hasMore: connection.hasMore,
    isLoadingMore: connection.isLoadingMore,
    loadMore: () => {
      void connection.loadMore();
    },
    retry: () => {
      void refetch();
    },
  };
}
