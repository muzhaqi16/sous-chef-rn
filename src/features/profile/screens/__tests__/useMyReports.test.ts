import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { MyReviewSubmissionsDocument } from '../useMyReports.generated';
import { useMyReports } from '../useMyReports';

type Page = MockDataFor<typeof MyReviewSubmissionsDocument>;

const page = (ids: string[], endCursor: string | null): Page => ({
  myReviewSubmissions: {
    __typename: 'ReviewSubmissionConnection',
    edges: ids.map(id => ({
      __typename: 'ReviewSubmissionEdge',
      node: { __typename: 'ItemSuggestionSubmission', id },
    })),
    pageInfo: {
      __typename: 'PageInfo',
      hasNextPage: endCursor !== null,
      endCursor,
    },
  },
});

// Page one ends at `cursor-1`; asking past it returns the older report.
const pagedMock = () =>
  recordMock(MyReviewSubmissionsDocument, {
    dataFor: vars =>
      vars.after === 'cursor-1'
        ? page(['report-1'], null)
        : page(['report-3', 'report-2'], 'cursor-1'),
  });

const ids = (result: { current: ReturnType<typeof useMyReports> }) =>
  result.current.reports.map(report => report.id);

describe('useMyReports', () => {
  it('reads the first page with the page size as a variable', async () => {
    const mock = pagedMock();
    const { result } = renderHookWithApollo(() => useMyReports(), {
      operationMocks: [mock.mock],
    });

    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(ids(result)).toEqual(['report-3', 'report-2']));

    expect(result.current.state).toBe('ready');
    expect(result.current.hasMore).toBe(true);
    expect(mock.fired).toEqual([{ first: 20 }]);
  });

  it('appends the next page after the last cursor', async () => {
    const mock = pagedMock();
    const { result } = renderHookWithApollo(() => useMyReports(), {
      operationMocks: [mock.mock],
    });
    await waitFor(() => expect(ids(result)).toHaveLength(2));

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() =>
      expect(ids(result)).toEqual(['report-3', 'report-2', 'report-1']),
    );
    expect(result.current.hasMore).toBe(false);
    expect(mock.fired).toContainEqual({ first: 20, after: 'cursor-1' });
  });

  it('reports an answered, empty list as empty rather than as a failure', async () => {
    const { result } = renderHookWithApollo(() => useMyReports(), {
      operationMocks: [
        recordMock(MyReviewSubmissionsDocument, { data: page([], null) }).mock,
      ],
    });

    await waitFor(() => expect(result.current.state).toBe('empty'));
    expect(result.current.reports).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  it('reports a read that never got an answer as an error to retry', async () => {
    const mock = recordMock(MyReviewSubmissionsDocument, {
      error: new Error('boom'),
    });
    const { result } = renderHookWithApollo(() => useMyReports(), {
      operationMocks: [mock.mock],
    });

    await waitFor(() => expect(result.current.state).toBe('error'));

    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(mock.fired).toHaveLength(2));
  });
});
