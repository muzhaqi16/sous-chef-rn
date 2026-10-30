import { ApolloClient, ApolloLink, Observable, gql } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { createAnswerOrderingLink } from '#/apollo/links/answerOrderingLink';
import type { Settled } from '#/apollo/utils/settleMutation';
import { drainTimers } from '#/test-utils/drainTimers';
import { PendingWrites, type LocalWriteSend } from '../pendingWrites';
import type { LocalWriteTable } from '../types';

const ROW = gql`
  query PendingRow {
    probeRow {
      id
      name
      quantity
      version
    }
  }
`;

const LIST = gql`
  query PendingRows {
    probeRows {
      id
      name
      quantity
      version
    }
  }
`;

const SET_QUANTITY = gql`
  mutation SetQuantity($input: SetQuantityInput!) {
    setQuantity(input: $input) {
      id
    }
  }
`;

const CREATE_ROW = gql`
  mutation CreateRow($input: CreateRowInput!) {
    createRow(input: $input) {
      id
      version
    }
  }
`;

const ADD_ROW = gql`
  mutation AddRow($input: AddRowInput!) {
    addRow(input: $input) {
      id
    }
  }
`;

const QUANTITY = gql`
  fragment PendingQuantity on ProbeItem {
    quantity
  }
`;

type Row = {
  __typename: 'ProbeItem';
  id: string;
  name: string;
  quantity: number;
  version: number;
};

const row = (
  name: string,
  quantity: number,
  version = 1,
  id = 'row-1',
): Row => ({
  __typename: 'ProbeItem',
  id,
  name,
  quantity,
  version,
});

type TestCache = ReturnType<typeof makeCache>;

const addEdge = (cache: TestCache, added: Row) => {
  const held = cache.readQuery<{ probeRows: Row[] }>({
    query: LIST,
    optimistic: true,
  });
  cache.writeQuery({
    query: LIST,
    data: { probeRows: [...(held?.probeRows ?? []), added] },
  });
};

const TABLE: LocalWriteTable = {
  CreateRow: {
    apply: (cache, { variables }) => {
      addEdge(cache as TestCache, row('New', 1, 0, variables.input.id));
    },
    commit: (cache, { variables }) => {
      addEdge(cache as TestCache, row('New', 1, 1, variables.input.id));
    },
  },
  SetQuantity: {
    apply: (cache, { variables }) => {
      cache.writeFragment({
        id: 'ProbeItem:row-1',
        fragment: QUANTITY,
        data: { __typename: 'ProbeItem', quantity: variables.input.quantity },
      });
    },
  },
  AddRow: {
    capture: () => ({ name: 'Captured' }),
    apply: (cache, { variables, inputs }) => {
      addEdge(
        cache as TestCache,
        row(String(inputs.name), 1, 0, variables.input.id),
      );
    },
    commit: (cache, _write, data) => {
      addEdge(cache as TestCache, data as Row);
    },
  },
};

const seeded = () => {
  const cache = makeCache();
  cache.writeQuery({ query: ROW, data: { probeRow: row('Milk', 1) } });
  cache.writeQuery({ query: LIST, data: { probeRows: [row('Milk', 1)] } });
  return { cache, pending: new PendingWrites(cache, TABLE) };
};

const shown = (cache: TestCache) =>
  cache.readQuery<{ probeRow: Row }>({ query: ROW, optimistic: true })
    ?.probeRow;
const server = (cache: TestCache) =>
  cache.readQuery<{ probeRow: Row }>({ query: ROW, optimistic: false })
    ?.probeRow;
const shownRows = (cache: TestCache) =>
  cache
    .readQuery<{ probeRows: Row[] }>({ query: LIST, optimistic: true })
    ?.probeRows.map(({ id }) => id);
const serverRows = (cache: TestCache) =>
  cache
    .readQuery<{ probeRows: Row[] }>({ query: LIST, optimistic: false })
    ?.probeRows.map(({ id }) => id);

afterEach(() => {
  jest.useRealTimers();
});

describe('PendingWrites', () => {
  it('shows a write over the server’s data and leaves that data alone', () => {
    const { cache, pending } = seeded();

    pending.begin(SET_QUANTITY, { input: { quantity: 5 } });

    expect(shown(cache)?.quantity).toBe(5);
    expect(server(cache)?.quantity).toBe(1);
  });

  it('keeps a write over a stale answer', () => {
    const { cache, pending } = seeded();
    pending.begin(SET_QUANTITY, { input: { quantity: 5 } });

    cache.writeQuery({ query: ROW, data: { probeRow: row('Milk', 1) } });
    pending.rebuild();

    expect(shown(cache)?.quantity).toBe(5);
  });

  it('shows the server’s newer other fields after a rebuild', () => {
    const { cache, pending } = seeded();
    pending.begin(SET_QUANTITY, { input: { quantity: 5 } });

    cache.writeQuery({ query: ROW, data: { probeRow: row('Oat milk', 1) } });
    pending.rebuild();

    expect(shown(cache)).toMatchObject({ name: 'Oat milk', quantity: 5 });
  });

  it('rebuilds once for several server writes, after their batch', async () => {
    jest.useFakeTimers();
    const { cache, pending } = seeded();
    pending.begin(SET_QUANTITY, { input: { quantity: 5 } });
    const rebuild = jest.spyOn(pending, 'rebuild');

    cache.batch({
      update: () => {
        cache.writeQuery({ query: ROW, data: { probeRow: row('Oat', 1) } });
        pending.scheduleRebuild();
        pending.scheduleRebuild();
      },
    });
    await drainTimers();

    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(shown(cache)).toMatchObject({ name: 'Oat', quantity: 5 });
  });

  it('applies writes in order, later ones over earlier', () => {
    const { cache, pending } = seeded();
    pending.begin(SET_QUANTITY, { input: { quantity: 2 } });
    const second = pending.begin(SET_QUANTITY, { input: { quantity: 3 } });
    pending.rebuild();

    expect(shown(cache)?.quantity).toBe(3);

    pending.drop(second.id);

    expect(shown(cache)?.quantity).toBe(2);
  });

  it('ends on the server’s data when a write is dropped', () => {
    const { cache, pending } = seeded();
    const { id } = pending.begin(SET_QUANTITY, { input: { quantity: 5 } });
    cache.writeQuery({ query: ROW, data: { probeRow: row('Oat milk', 3) } });

    pending.drop(id);

    expect(shown(cache)).toMatchObject({ name: 'Oat milk', quantity: 3 });
  });

  it('commits a create’s edge to the server’s data and lifts its layer', () => {
    const { cache, pending } = seeded();
    const { id } = pending.begin(ADD_ROW, { input: { id: 'row-2' } });
    expect(serverRows(cache)).toEqual(['row-1']);
    expect(shownRows(cache)).toEqual(['row-1', 'row-2']);

    pending.confirm(id, row('Server name', 1, 1, 'row-2'));

    expect(serverRows(cache)).toEqual(['row-1', 'row-2']);
    expect(shownRows(cache)).toEqual(['row-1', 'row-2']);
    expect(pending.get(id)).toBeUndefined();
  });

  it('commits the write’s own change when the answer holds no row', () => {
    const { cache, pending } = seeded();
    const { id } = pending.begin(ADD_ROW, { input: { id: 'row-2' } });

    pending.confirm(id);

    const stored = cache.extract()['ProbeItem:row-2'];
    expect(serverRows(cache)).toEqual(['row-1', 'row-2']);
    expect(stored).toMatchObject({ name: 'Captured', version: 0 });
  });

  it('captures inputs once, so a rebuild writes the same thing', () => {
    const capture = jest.fn(() => ({ name: 'Once' }));
    const cache = makeCache();
    const pending = new PendingWrites(cache, {
      AddRow: { ...TABLE.AddRow!, capture },
    });

    pending.begin(ADD_ROW, { input: { id: 'row-2' } });
    pending.rebuild();
    pending.rebuild();

    expect(capture).toHaveBeenCalledTimes(1);
    expect(cache.extract(true)['ProbeItem:row-2']).toMatchObject({
      name: 'Once',
    });
  });

  it('drops the queued writes the queue no longer holds', () => {
    const { cache, pending } = seeded();
    const first = pending.begin(SET_QUANTITY, { input: { quantity: 2 } });
    const second = pending.begin(SET_QUANTITY, { input: { quantity: 3 } });
    pending.markQueued(first.id);
    pending.markQueued(second.id);

    pending.keepQueued(() => new Set([first.id]));

    expect(pending.get(second.id)).toBeUndefined();
    expect(shown(cache)?.quantity).toBe(2);
  });

  it('rebuilds a stored queue’s writes over an empty cache', () => {
    const cache = makeCache();
    const pending = new PendingWrites(cache, TABLE);

    pending.restore([
      {
        id: 'write-1',
        operationName: 'AddRow',
        document: ADD_ROW,
        variables: { input: { id: 'row-2' } },
        inputs: { name: 'Stored' },
      },
    ]);

    expect(shownRows(cache)).toEqual(['row-2']);
    expect(cache.extract()['ProbeItem:row-2']).toBeUndefined();
  });

  it('runs each write once in a rebuild, over the server’s data', () => {
    const apply = jest.fn(TABLE.SetQuantity!.apply);
    const cache = makeCache();
    cache.writeQuery({ query: ROW, data: { probeRow: row('Milk', 1) } });
    const pending = new PendingWrites(cache, {
      SetQuantity: { apply },
    });
    pending.begin(SET_QUANTITY, { input: { quantity: 5 } });
    apply.mockClear();

    pending.rebuild();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(shown(cache)?.quantity).toBe(5);
  });

  it('lays the writes back after a cache reset took their layers', async () => {
    const { cache, pending } = seeded();
    pending.begin(SET_QUANTITY, { input: { quantity: 5 } });

    await cache.reset();
    cache.writeQuery({ query: ROW, data: { probeRow: row('Milk', 1) } });
    pending.rebuild();

    expect(shown(cache)?.quantity).toBe(5);
  });

  it('lifts the last write’s layer once it commits', async () => {
    jest.useFakeTimers();
    const { cache, pending } = seeded();
    const { id } = pending.begin(SET_QUANTITY, { input: { quantity: 5 } });

    pending.confirm(id, {});
    await drainTimers();

    expect(shown(cache)?.quantity).toBe(1);
  });

  it('leaves no layer when cleared', () => {
    const { cache, pending } = seeded();
    pending.begin(SET_QUANTITY, { input: { quantity: 5 } });

    pending.clear();

    expect(shown(cache)?.quantity).toBe(1);
  });

  it('a write that fails to apply does not take the others with it', () => {
    const cache = makeCache();
    cache.writeQuery({ query: ROW, data: { probeRow: row('Milk', 1) } });
    const pending = new PendingWrites(cache, {
      ...TABLE,
      AddRow: {
        apply: () => {
          throw new Error('broken');
        },
      },
    });

    pending.begin(ADD_ROW, { input: { id: 'row-2' } });
    pending.begin(SET_QUANTITY, { input: { quantity: 5 } });
    pending.rebuild();

    expect(shown(cache)?.quantity).toBe(5);
  });

  describe('sending', () => {
    const applied = (data: unknown) => ({ status: 'applied' as const, data });

    /** A send whose answer the test gives, recording what it sent with. */
    const held = (
      pending: PendingWrites,
      document: DocumentNode,
      input: object,
    ) => {
      const sent: LocalWriteSend[] = [];
      let answer: (settled: Settled<unknown>) => void = () => undefined;
      const result = pending.send(document, { input }, send => {
        sent.push(send);
        return new Promise<Settled<unknown>>(resolve => {
          answer = settled => {
            send.update(makeCache(), { data: settled.data });
            resolve(settled);
          };
        });
      });
      return { sent, result, answer: (s: Settled<unknown>) => answer(s) };
    };

    it('sends an edit after its row’s create answers, at the version it returned', async () => {
      const { cache, pending } = seeded();
      const create = held(pending, CREATE_ROW, { id: 'row-2' });
      await Promise.resolve();
      const edit = held(pending, SET_QUANTITY, {
        id: 'row-2',
        quantity: 3,
        version: 0,
      });
      await Promise.resolve();

      expect(create.sent).toHaveLength(1);
      expect(edit.sent).toHaveLength(0);
      expect(shownRows(cache)).toContain('row-2');

      create.answer(
        applied({
          createRow: { __typename: 'ProbeItem', id: 'row-2', version: 1 },
        }),
      );
      await create.result;
      await new Promise(resolve => setImmediate(resolve));

      expect(edit.sent[0]?.variables.input).toMatchObject({ version: 1 });
      edit.answer(applied({ setQuantity: { id: 'row-2', version: 2 } }));
      await edit.result;
    });

    it('sends two writes to one row in order', async () => {
      const { pending } = seeded();
      const first = held(pending, SET_QUANTITY, { id: 'row-1', quantity: 2 });
      const second = held(pending, SET_QUANTITY, { id: 'row-1', quantity: 3 });
      await Promise.resolve();

      expect(second.sent).toHaveLength(0);

      first.answer(applied({ setQuantity: { id: 'row-1' } }));
      await first.result;
      await new Promise(resolve => setImmediate(resolve));

      expect(second.sent).toHaveLength(1);
      second.answer(applied({ setQuantity: { id: 'row-1' } }));
      await second.result;
    });

    it('does not hold a write to another row', async () => {
      const { pending } = seeded();
      const first = held(pending, SET_QUANTITY, { id: 'row-1', quantity: 2 });
      const other = held(pending, SET_QUANTITY, { id: 'row-2', quantity: 3 });
      await Promise.resolve();
      await Promise.resolve();

      expect(other.sent).toHaveLength(1);
      first.answer(applied({}));
      other.answer(applied({}));
      await Promise.all([first.result, other.result]);
    });

    it('refuses an edit with the create it depends on, and reports one failure', async () => {
      const { cache, pending } = seeded();
      const create = held(pending, CREATE_ROW, { id: 'row-2' });
      await Promise.resolve();
      const edit = held(pending, SET_QUANTITY, { id: 'row-2', quantity: 3 });
      await Promise.resolve();

      const failed: Settled<unknown> = { status: 'failed', data: undefined };
      create.answer(failed);
      await expect(edit.result).resolves.toEqual(failed);

      expect(edit.sent).toHaveLength(0);
      expect(shownRows(cache)).toEqual(['row-1']);
    });

    it('leaves a queued write pending, for the queue to settle', async () => {
      const { cache, pending } = seeded();
      const queued = held(pending, SET_QUANTITY, { id: 'row-1', quantity: 5 });
      await Promise.resolve();

      queued.answer({ status: 'queued', data: undefined });
      await queued.result;

      expect(shown(cache)?.quantity).toBe(5);
    });
  });

  describe('a row’s version', () => {
    const ITEM = gql`
      query PendingItem {
        probeItem {
          id
          version
          name
        }
      }
    `;
    const ITEM_ROW = gql`
      fragment PendingItemRow on Item {
        id
        version
        name
      }
    `;
    const CREATE_ITEM = gql`
      mutation CreateItemRow($input: CreateItemRowInput!) {
        createItemRow(input: $input) {
          id
        }
      }
    `;
    const RENAME_ITEM = gql`
      mutation RenameItemRow($input: RenameItemRowInput!) {
        renameItemRow(input: $input) {
          id
        }
      }
    `;
    const item = (version: number, name: string) => ({
      __typename: 'Item',
      id: 'item-1',
      version,
      name,
    });
    const table: LocalWriteTable = {
      CreateItemRow: {
        apply: cache => {
          cache.writeQuery({
            query: ITEM,
            data: { probeItem: item(0, 'Guess') },
          });
        },
      },
      RenameItemRow: {
        apply: (cache, { variables }) => {
          const held = cache.readFragment<ReturnType<typeof item>>({
            id: 'Item:item-1',
            fragment: ITEM_ROW,
          });
          if (!held) return;
          cache.writeFragment({
            id: 'Item:item-1',
            fragment: ITEM_ROW,
            data: { ...held, name: variables.input.name },
          });
        },
      },
    };

    it('lets the server’s next answer land over a commit that held no row', async () => {
      const cache = makeCache();
      const pending = new PendingWrites(cache, table);
      const { id } = pending.begin(CREATE_ITEM, { input: { id: 'item-1' } });
      pending.confirm(id);
      expect(cache.extract()['Item:item-1']).toMatchObject({ version: 0 });

      const client = new ApolloClient({
        cache,
        defaultOptions: APOLLO_DEFAULT_OPTIONS,
        link: ApolloLink.from([
          createAnswerOrderingLink(),
          new ApolloLink(
            () =>
              new Observable(observer => {
                observer.next({ data: { probeItem: item(1, 'Server') } });
                observer.complete();
              }),
          ),
        ]),
      });
      await client.query({ query: ITEM, fetchPolicy: 'network-only' });

      expect(cache.extract()['Item:item-1']).toMatchObject({
        version: 1,
        name: 'Server',
      });
    });

    it('keeps a held row’s version under a write over it', () => {
      const cache = makeCache();
      cache.writeQuery({ query: ITEM, data: { probeItem: item(4, 'Milk') } });
      const pending = new PendingWrites(cache, table);

      pending.begin(RENAME_ITEM, { input: { name: 'Oat milk' } });

      expect(cache.readQuery({ query: ITEM, optimistic: true })).toEqual({
        probeItem: item(4, 'Oat milk'),
      });
    });
  });

  it('refuses a write no local write is registered for', () => {
    const { pending } = seeded();
    const unregistered = gql`
      mutation Unregistered {
        unregistered {
          id
        }
      }
    `;

    expect(() => pending.begin(unregistered, {})).toThrow('Unregistered');
  });
});
