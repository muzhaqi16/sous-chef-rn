import { gql } from '@apollo/client';
import { createApolloClient } from '#/apollo/client';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';

const ROW = gql`
  query PendingOverAnswer {
    probeRow {
      id
      name
      ticked
    }
  }
`;

const TICK = gql`
  mutation TickRow {
    tickRow {
      id
    }
  }
`;

const TICKED = gql`
  fragment PendingOverAnswerTicked on ProbeItem {
    ticked
  }
`;

const row = (name: string, ticked: boolean) => ({
  __typename: 'ProbeItem',
  id: 'row-1',
  name,
  ticked,
});

const mockAnswers: Record<string, unknown>[] = [];

jest.mock('#/apollo/links/index', () => {
  const apollo =
    jest.requireActual<typeof import('@apollo/client')>('@apollo/client');
  return {
    createLink: () =>
      new apollo.ApolloLink(
        () =>
          new apollo.Observable(observer => {
            observer.next({ data: mockAnswers.shift() ?? null });
            observer.complete();
          }),
      ),
  };
});

jest.mock('#/apollo/pendingWrites/localWriteRegistry', () => ({
  LOCAL_WRITES: {
    TickRow: {
      apply: (cache: {
        writeFragment: (options: Record<string, unknown>) => void;
      }) => {
        cache.writeFragment({
          id: 'ProbeItem:row-1',
          fragment: mockTicked(),
          data: { __typename: 'ProbeItem', ticked: true },
        });
      },
    },
  },
}));

const mockTicked = () => TICKED;

describe('a pending write as the server answers', () => {
  it('ends showing the answer’s rename with the tick, which never reads unticked', async () => {
    const client = createApolloClient();
    mockAnswers.push({ probeRow: row('Milk', false) });
    await client.query({ query: ROW, fetchPolicy: 'network-only' });

    const seen: unknown[] = [];
    const stop = client.cache.watch<{
      probeRow: ReturnType<typeof row>;
    }>({
      query: ROW,
      optimistic: true,
      callback: diff => {
        seen.push(diff.result?.probeRow?.ticked);
      },
    });

    pendingWritesOf(client.cache).begin(TICK, {});
    expect(seen).toEqual([true]);

    mockAnswers.push({ probeRow: row('Oat milk', false) });
    await client.query({ query: ROW, fetchPolicy: 'network-only' });
    await new Promise(resolve => setTimeout(resolve, 60));
    stop();

    expect(seen).not.toContain(false);
    expect(client.cache.readQuery({ query: ROW, optimistic: true })).toEqual({
      probeRow: row('Oat milk', true),
    });
    const stored: Record<string, unknown> = client.cache.extract() as Record<
      string,
      unknown
    >;
    expect(stored['ProbeItem:row-1']).toMatchObject({
      name: 'Oat milk',
      ticked: false,
    });
  });
});
