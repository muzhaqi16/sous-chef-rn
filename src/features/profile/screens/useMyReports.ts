import { useQuery } from '@apollo/client/react';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import { useDataState } from '#hooks/data/useDataState';
import {
  MyReviewSubmissionsDocument,
  type MyReviewSubmissionsQuery,
} from './useMyReports.generated';

const PAGE_SIZE = 20;

/** A submission as the list holds it: the row reads its own fragment off this ref. */
export type MyReportNode =
  MyReviewSubmissionsQuery['myReviewSubmissions']['edges'][number]['node'];

/**
 * Everything the signed-in person sent for review, newest first, a page at a
 * time: their reports, suggested edits and photos awaiting moderation.
 */
export function useMyReports() {
  const { data, loading, error, refetch, observable } = useQuery(
    MyReviewSubmissionsDocument,
    { variables: { first: PAGE_SIZE } },
  );

  const connection = useConnectionData({
    data,
    selector: result => result.myReviewSubmissions,
    key: 'MyReviewSubmissions',
    loading,
    observable,
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
