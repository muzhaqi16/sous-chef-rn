import { act } from '@testing-library/react-native';
import { gql, type TypedDocumentNode } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { GraphQLError } from 'graphql';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { errorService } from '#/services/errorService';
import { useStore } from '#store';
import { usePagination, type PaginationConfig } from '../usePagination';

jest.mock('#/services/errorService');

/** A page as the list asks for it; its variables are what the hook sends. */
const PAGE: TypedDocumentNode<
  { me: { __typename: 'User'; id: string } | null },
  Record<string, unknown>
> = gql`
  query Page($cursor: String, $itemsCursor: String, $id: ID) {
    me {
      id
    }
  }
`;

const OBSERVABLE = { query: PAGE, variables: {} };

let log = operationLog();

type Answer = ReturnType<typeof recordMock>;

/** The server's answer to a page request, whatever its variables. */
const page = ({
  held = false,
  error,
  once = false,
}: { held?: boolean; error?: Error; once?: boolean } = {}): Answer =>
  recordMock(PAGE, {
    match: () => true,
    held,
    ...(error ? { error } : { data: { me: { __typename: 'User', id: 'me' } } }),
    ...(once ? { maxUsageCount: 1 } : {}),
  });

/** What every page request sent, in order. */
const sentBy = (...answers: Answer[]) =>
  answers.flatMap(answer => answer.fired);

const LIST = {
  pageInfo: { hasNextPage: true, endCursor: 'abc' },
  loading: false,
  itemCount: 10,
  observable: OBSERVABLE,
} satisfies PaginationConfig;

function renderPagination<TProps>(
  config: (props: TProps) => PaginationConfig,
  {
    answers = [page()],
    initialProps,
  }: { answers?: Answer[]; initialProps?: TProps } = {},
) {
  return renderHookWithApollo((props: TProps) => usePagination(config(props)), {
    links: [log.link],
    operationMocks: answers.map(answer => answer.mock),
    ...(initialProps === undefined ? {} : { initialProps }),
  });
}

/** Lets a request the last change started reach the network, if one did. */
const settle = () => act(() => Promise.resolve());

/** Jest draws no frames: each frame runs as soon as it is asked for. */
const framesRunAtOnce = () =>
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(run => {
    run(0);
    return 1;
  });

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useStore.setState({ isOnline: true, apiReachable: null });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  useStore.setState({ isOnline: true, apiReachable: null });
});

describe('offline', () => {
  const goOffline = () => {
    useStore.setState({ isOnline: false, apiReachable: null });
  };
  const comeBack = () => {
    act(() => {
      useStore.setState({ isOnline: true, apiReachable: true });
    });
  };

  it('asks for no page, and reports no failure', async () => {
    goOffline();
    const answer = page();
    const { result } = renderPagination(() => LIST, { answers: [answer] });

    await act(() => result.current.loadMore());

    expect(answer.fired).toHaveLength(0);
    expect(result.current.loadMoreError).toBe(false);
    expect(result.current.isLoadingMore).toBe(false);
    expect(result.current.hasMore).toBe(true);
  });

  it('loads the page it held back once the server can answer', async () => {
    goOffline();
    const answer = page();
    const { result } = renderPagination(() => LIST, { answers: [answer] });
    await act(() => result.current.loadMore());

    comeBack();
    await act(() => log.requested(PAGE));

    expect(answer.fired).toEqual([{ cursor: 'abc' }]);
  });

  it('waits for a read running at reconnect before asking', async () => {
    goOffline();
    const answer = page();
    const { result, rerender } = renderPagination(
      ({ loading }: { loading: boolean }) => ({ ...LIST, loading }),
      { answers: [answer], initialProps: { loading: false } },
    );
    await act(() => result.current.loadMore());

    rerender({ loading: true });
    comeBack();
    await settle();
    expect(answer.fired).toHaveLength(0);

    rerender({ loading: false });
    await act(() => log.requested(PAGE));
    expect(answer.fired).toHaveLength(1);
  });

  it('asks for nothing at reconnect when no page was held back', async () => {
    goOffline();
    const answer = page();
    renderPagination(() => LIST, { answers: [answer] });

    comeBack();
    await settle();

    expect(answer.fired).toHaveLength(0);
  });

  it('reads a connection lost mid-page as offline, not as a failure', async () => {
    const lost = page({
      held: true,
      once: true,
      error: new Error('Network request failed'),
    });
    const later = page();
    const { result } = renderPagination(() => LIST, { answers: [lost, later] });

    let loading!: Promise<void>;
    act(() => {
      loading = result.current.loadMore();
    });
    await act(() => log.requested(PAGE));
    goOffline();
    lost.release();
    await act(() => loading);

    expect(errorService.reportError).not.toHaveBeenCalled();
    expect(result.current.loadMoreError).toBe(false);

    comeBack();
    await act(() => log.requested(PAGE, 2));
    expect(sentBy(lost, later)).toHaveLength(2);
  });

  it('still reports a page that fails online', async () => {
    const { result } = renderPagination(() => LIST, {
      answers: [page({ error: new Error('boom') })],
    });

    await act(() => result.current.loadMore());

    expect(errorService.reportError).toHaveBeenCalledTimes(1);
    expect(result.current.loadMoreError).toBe(true);
  });
});

it.each([true, false])(
  'hasMore follows pageInfo.hasNextPage %s',
  hasNextPage => {
    const { result } = renderPagination(() => ({
      ...LIST,
      pageInfo: { hasNextPage, endCursor: 'abc' },
    }));

    expect(result.current.hasMore).toBe(hasNextPage);
  },
);

it('asks for the page with the cursor and the extra variables', async () => {
  const answer = page();
  const { result } = renderPagination(
    () => ({
      ...LIST,
      pageInfo: { hasNextPage: true, endCursor: 'cursor-abc' },
      fetchMoreVariables: { id: 'list-1' },
    }),
    { answers: [answer] },
  );

  await act(() => result.current.loadMore());

  expect(answer.fired).toEqual([{ id: 'list-1', cursor: 'cursor-abc' }]);
});

it('sends the cursor under the name the connection gives it', async () => {
  const answer = page();
  const { result } = renderPagination(
    () => ({
      ...LIST,
      pageInfo: { hasNextPage: true, endCursor: 'cursor-xyz' },
      cursorVariableName: 'itemsCursor',
    }),
    { answers: [answer] },
  );

  await act(() => result.current.loadMore());

  expect(answer.fired).toEqual([{ itemsCursor: 'cursor-xyz' }]);
});

it('restarts when the server refuses a cursor the connection names its own way', async () => {
  // The pantry is the one caller that supplies `restart`, and its cursor
  // argument is `itemsCursor` — so a recogniser keyed on `after`/`cursor`
  // leaves exactly that list stranded at the page it stopped on.
  const refusal = new CombinedGraphQLErrors({
    errors: [
      new GraphQLError('Invalid cursor.', {
        extensions: { code: 'VALIDATION_FAILED' },
      }),
    ],
  });
  const restart = jest.fn().mockResolvedValue({});
  const { result } = renderPagination(
    () => ({
      ...LIST,
      pageInfo: { hasNextPage: true, endCursor: 'stale-cursor' },
      cursorVariableName: 'itemsCursor',
      restart,
    }),
    { answers: [page({ error: refusal })] },
  );

  await act(() => result.current.loadMore());

  expect(restart).toHaveBeenCalledTimes(1);
  expect(result.current.loadMoreError).toBe(false);
});

it.each([
  {
    without: 'a next page',
    hasNextPage: false,
    endCursor: 'cursor-abc',
    loading: false,
  },
  {
    without: 'the list settled',
    hasNextPage: true,
    endCursor: 'cursor-abc',
    loading: true,
  },
  { without: 'a cursor', hasNextPage: true, endCursor: null, loading: false },
])(
  'asks for nothing without $without',
  async ({ hasNextPage, endCursor, loading }) => {
    const answer = page();
    const { result } = renderPagination(
      () => ({ ...LIST, pageInfo: { hasNextPage, endCursor }, loading }),
      { answers: [answer] },
    );

    await act(() => result.current.loadMore());

    expect(answer.fired).toHaveLength(0);
  },
);

it.each([5, 0])(
  'is not loading more during the first read, with %i rows held',
  itemCount => {
    const { result } = renderPagination(() => ({
      ...LIST,
      loading: true,
      itemCount,
    }));

    expect(result.current.isLoadingMore).toBe(false);
  },
);

it('is loading more while a page is out, and not after', async () => {
  const answer = page({ held: true });
  const { result } = renderPagination(() => LIST, { answers: [answer] });
  expect(result.current.isLoadingMore).toBe(false);

  let loading!: Promise<void>;
  act(() => {
    loading = result.current.loadMore();
  });
  expect(result.current.isLoadingMore).toBe(true);

  await act(async () => {
    answer.release();
    await loading;
  });
  expect(result.current.isLoadingMore).toBe(false);
});

it('clears a failure as soon as the next try starts', async () => {
  framesRunAtOnce();
  const next = page({ held: true });
  const { result } = renderPagination(() => LIST, {
    answers: [page({ once: true, error: new Error('boom') }), next],
  });
  await act(() => result.current.loadMore());
  expect(result.current.loadMoreError).toBe(true);

  let loading!: Promise<void>;
  act(() => {
    loading = result.current.loadMore();
  });
  expect(result.current.loadMoreError).toBe(false);

  await act(async () => {
    next.release();
    await loading;
  });
  expect(result.current.loadMoreError).toBe(false);
});

it('opens for the next page after one that settles in a single render', async () => {
  framesRunAtOnce();
  const failing = page({ once: true, error: new Error('network unavailable') });
  const next = page();
  const { result } = renderPagination(() => LIST, { answers: [failing, next] });

  await act(() => result.current.loadMore());
  await act(() => result.current.loadMore());

  expect(sentBy(failing, next)).toHaveLength(2);
});

it('asks for nothing more while a page is out', async () => {
  const answer = page({ held: true });
  const { result } = renderPagination(() => LIST, { answers: [answer] });

  let loading!: Promise<void>;
  act(() => {
    loading = result.current.loadMore();
  });
  await act(() => result.current.loadMore());
  expect(answer.fired).toHaveLength(1);

  await act(async () => {
    answer.release();
    await loading;
  });
});

it('reads the new pageInfo before asking again, not the closure it started with', async () => {
  // The page lands and Apollo publishes the last page: a stale onEndReached
  // with the old cursor must not ask again.
  const answer = page({ held: true });
  const { result, rerender } = renderPagination(
    (props: { hasMore: boolean; endCursor: string }) => ({
      ...LIST,
      pageInfo: { hasNextPage: props.hasMore, endCursor: props.endCursor },
    }),
    {
      answers: [answer],
      initialProps: { hasMore: true, endCursor: 'cursor-60' },
    },
  );

  let loading!: Promise<void>;
  act(() => {
    loading = result.current.loadMore();
  });
  await act(async () => {
    answer.release();
    await loading;
  });
  rerender({ hasMore: false, endCursor: 'cursor-79' });
  await act(() => result.current.loadMore());

  expect(answer.fired).toHaveLength(1);
});

it('sends one page for two calls made before a render', async () => {
  const answer = page({ held: true });
  const { result } = renderPagination(() => LIST, { answers: [answer] });

  let first!: Promise<void>;
  let second!: Promise<void>;
  act(() => {
    first = result.current.loadMore();
    second = result.current.loadMore();
  });
  expect(answer.fired).toHaveLength(1);

  await act(async () => {
    answer.release();
    await first;
    await second;
  });
});

it('a page settling does not re-open for the next page until a frame later', async () => {
  // The append and `setIsFetchingMore(false)` batch into one commit, and
  // `endCursor` has already advanced by then. Releasing the guard inside that
  // commit let a fling's next onEndReached start page N+1 while page N was
  // still mounting, so two pages landed together.
  const raf = jest
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation(() => 1);
  const answer = page();
  const { result, rerender } = renderPagination(
    (props: { endCursor: string }) => ({
      ...LIST,
      pageInfo: { hasNextPage: true, endCursor: props.endCursor },
      itemCount: 25,
    }),
    { answers: [answer], initialProps: { endCursor: 'cursor-25' } },
  );

  await act(() => result.current.loadMore());
  rerender({ endCursor: 'cursor-50' });
  await act(() => result.current.loadMore());
  expect(answer.fired).toHaveLength(1);

  const release = raf.mock.calls.at(-1)?.[0];
  act(() => release?.(0));
  await act(() => result.current.loadMore());

  expect(answer.fired).toEqual([
    { cursor: 'cursor-25' },
    { cursor: 'cursor-50' },
  ]);
});
