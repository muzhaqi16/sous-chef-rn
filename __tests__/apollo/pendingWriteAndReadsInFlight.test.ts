import { ApolloClient, ApolloLink, Observable, gql } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import type { Subscriber } from 'rxjs';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { createAnswerOrderingLink } from '#/apollo/links/answerOrderingLink';
import { createLocalWritePrecedenceLink } from '#/apollo/links/localWritePrecedenceLink';
import { PendingWrites } from '#/apollo/pendingWrites/pendingWrites';
import type { LocalWriteTable } from '#/apollo/pendingWrites/types';
import { drainTimers } from '#/test-utils/drainTimers';

const ROW = gql`
  query FenceRow {
    probeRow {
      id
      name
      pinned
    }
  }
`;

const ROWS = gql`
  query FenceRows {
    probeRows {
      id
      name
    }
  }
`;

const PIN = gql`
  mutation PinRow($input: PinRowInput!) {
    pinRow(input: $input) {
      id
      pinned
    }
  }
`;

const REMOVE = gql`
  mutation RemoveRow($input: RemoveRowInput!) {
    removeRow(input: $input) {
      id
    }
  }
`;

const PINNED = gql`
  fragment FencePinned on ProbeItem {
    pinned
  }
`;

const row = (name: string, pinned: boolean) => ({
  __typename: 'ProbeItem',
  id: 'row-1',
  name,
  pinned,
});
const listed = (id: string) => ({ __typename: 'ProbeItem', id, name: id });

const leaveList = (
  cache: Parameters<LocalWriteTable[string]['apply']>[0],
  id: string,
) => {
  cache.modify<{ probeRows: readonly { __ref: string }[] }>({
    id: 'ROOT_QUERY',
    fields: {
      probeRows: rows =>
        (rows as readonly { __ref: string }[]).filter(
          ({ __ref }) => __ref !== `ProbeItem:${id}`,
        ),
    },
  });
};

const TABLE: LocalWriteTable = {
  PinRow: {
    apply: (cache, { variables }) => {
      cache.writeFragment({
        id: 'ProbeItem:row-1',
        fragment: PINNED,
        data: { __typename: 'ProbeItem', pinned: variables.input.pinned },
      });
    },
  },
  RemoveRow: {
    apply: (cache, { variables }) => leaveList(cache, variables.input.id),
    commit: (cache, { variables }) => leaveList(cache, variables.input.id),
  },
};

function setUp() {
  const cache = makeCache();
  const pending = new PendingWrites(cache, TABLE);
  const open = new Map<string, Subscriber<ApolloLink.Result>[]>();
  const requests: string[] = [];
  const client = new ApolloClient({
    cache,
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: ApolloLink.from([
      createLocalWritePrecedenceLink(),
      createAnswerOrderingLink(),
      new ApolloLink(operation => {
        const name = operation.operationName ?? '';
        requests.push(name);
        return new Observable(observer => {
          open.set(name, [...(open.get(name) ?? []), observer]);
        });
      }),
    ]),
  });
  const answer = (name: string, data: object) => {
    const [observer, ...rest] = open.get(name) ?? [];
    open.set(name, rest);
    observer?.next({ data });
    observer?.complete();
  };
  const write = (document: DocumentNode, input: object) =>
    pending.send(document, { input }, send =>
      client
        .mutate({
          mutation: document,
          variables: send.variables,
          context: send.context,
          update: send.update,
        })
        .then(({ data }) => ({ status: 'applied' as const, data })),
    );
  const shown = () =>
    cache.readQuery<{ probeRow: ReturnType<typeof row> }>({
      query: ROW,
      optimistic: true,
    })?.probeRow;
  const refresh = () =>
    client.query({ query: ROW, fetchPolicy: 'network-only' });
  return { cache, client, pending, answer, write, shown, refresh, requests };
}

// The rebuild window and a page's landing run on the test's clock. A drain also
// passes the read fence's cap, so none runs while a confirmed write waits.
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('a pending write and the reads around it', () => {
  it('stays when a refresh sent while it was on its way answers last', async () => {
    const { cache, answer, write, shown, refresh } = setUp();
    cache.writeQuery({ query: ROW, data: { probeRow: row('Milk', false) } });

    const pin = write(PIN, { id: 'row-1', pinned: true });
    await drainTimers();
    const late = refresh();
    await drainTimers();

    answer('PinRow', {
      pinRow: { __typename: 'ProbeItem', id: 'row-1', pinned: true },
    });
    await pin;
    expect(shown()?.pinned).toBe(true);

    answer('FenceRow', { probeRow: row('Milk', false) });
    await late;
    await drainTimers();

    expect(shown()?.pinned).toBe(true);
    expect(
      cache.readQuery<{ probeRow: ReturnType<typeof row> }>({
        query: ROW,
        optimistic: false,
      })?.probeRow.pinned,
    ).toBe(true);
  });

  it('shows what a later read says of it, once it has landed', async () => {
    const { cache, answer, write, shown, refresh } = setUp();
    cache.writeQuery({ query: ROW, data: { probeRow: row('Milk', false) } });

    const pin = write(PIN, { id: 'row-1', pinned: true });
    await drainTimers();
    answer('PinRow', {
      pinRow: { __typename: 'ProbeItem', id: 'row-1', pinned: true },
    });
    await pin;

    const later = refresh();
    await drainTimers();
    answer('FenceRow', { probeRow: row('Milk', false) });
    await later;
    await drainTimers();

    expect(shown()?.pinned).toBe(false);
  });

  it('lands a late read’s other changes under the write, with no second request', async () => {
    const { cache, client, answer, write, shown, requests } = setUp();
    cache.writeQuery({ query: ROW, data: { probeRow: row('Milk', false) } });
    const seen: unknown[] = [];
    const watching = client
      .watchQuery<{ probeRow: ReturnType<typeof row> }>({
        query: ROW,
        fetchPolicy: 'cache-and-network',
      })
      .subscribe(({ data }) => seen.push(data?.probeRow));
    await drainTimers();

    const pin = write(PIN, { id: 'row-1', pinned: true });
    await drainTimers();
    expect(seen.at(-1)).toMatchObject({ pinned: true });

    answer('FenceRow', { probeRow: row('Oat milk', false) });
    await drainTimers();
    answer('PinRow', {
      pinRow: { __typename: 'ProbeItem', id: 'row-1', pinned: true },
    });
    await pin;
    await drainTimers();

    expect(shown()).toMatchObject({ name: 'Oat milk', pinned: true });
    expect(requests.filter(name => name === 'FenceRow')).toHaveLength(1);
    watching.unsubscribe();
  });

  it('keeps a removed row out of the list when a page from before it lands', async () => {
    const { cache, client, answer, write } = setUp();
    cache.writeQuery({
      query: ROWS,
      data: { probeRows: [listed('a'), listed('b')] },
    });

    const page = client.query({
      query: ROWS,
      fetchPolicy: 'network-only',
      context: { page: true },
    });
    await drainTimers();
    const removal = write(REMOVE, { id: 'b' });
    await drainTimers();
    answer('RemoveRow', { removeRow: { __typename: 'ProbeItem', id: 'b' } });
    await removal;

    answer('FenceRows', { probeRows: [listed('a'), listed('b')] });
    await page;
    await drainTimers();
    await drainTimers();

    const ids = cache
      .readQuery<{ probeRows: { id: string }[] }>({
        query: ROWS,
        optimistic: false,
      })
      ?.probeRows.map(({ id }) => id);
    expect(ids).toEqual(['a']);
  });
});
