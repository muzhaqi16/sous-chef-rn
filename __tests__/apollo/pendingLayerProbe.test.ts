import { gql, type Reference } from '@apollo/client';
import { makeCache } from '#/apollo/cache';

/**
 * What an optimistic layer keeps over later writes to the root, and how layers
 * can be swapped. Apollo Client 4.2.12. Recorded in
 * docs/verified-library-behaviour.md.
 */

const ROW = gql`
  query ProbeRow {
    probeRow {
      id
      name
      quantity
    }
  }
`;

const ROW_LIST = gql`
  query ProbeRows {
    probeRows {
      id
      name
      quantity
    }
  }
`;

const QUANTITY = gql`
  fragment ProbeQuantity on ProbeItem {
    quantity
  }
`;

interface ProbeRowData {
  probeRow: { id: string; name: string; quantity: number };
}

interface ProbeRowsData {
  probeRows: { id: string; name: string; quantity: number }[];
}

const row = (name: string, quantity: number, id = 'row-1') => ({
  __typename: 'ProbeItem',
  id,
  name,
  quantity,
});

const seeded = () => {
  const cache = makeCache();
  cache.writeQuery({ query: ROW, data: { probeRow: row('Milk', 1) } });
  return cache;
};

type ProbeCache = ReturnType<typeof makeCache>;

const setQuantity = (cache: ProbeCache, quantity: number, id = 'row-1') =>
  cache.writeFragment({
    id: `ProbeItem:${id}`,
    fragment: QUANTITY,
    data: { __typename: 'ProbeItem', quantity },
  });

const optimisticRead = (cache: ProbeCache) =>
  cache.readQuery<ProbeRowData>({ query: ROW, optimistic: true })?.probeRow;

const rootRead = (cache: ProbeCache) =>
  cache.readQuery<ProbeRowData>({ query: ROW, optimistic: false })?.probeRow;

describe('an optimistic layer over the root', () => {
  it('keeps its field when the root takes an older value', () => {
    const cache = seeded();
    cache.recordOptimisticTransaction(c => {
      setQuantity(c as ProbeCache, 5);
    }, 'write-1');

    cache.writeQuery({ query: ROW, data: { probeRow: row('Milk', 1) } });

    expect(optimisticRead(cache)?.quantity).toBe(5);
    expect(rootRead(cache)?.quantity).toBe(1);
  });

  it('copies the whole entity, hiding the root’s later change to another field until it is re-added', () => {
    const cache = seeded();
    const apply = (c: unknown) => {
      setQuantity(c as ProbeCache, 5);
    };
    cache.recordOptimisticTransaction(apply, 'write-1');

    cache.writeQuery({ query: ROW, data: { probeRow: row('Oat milk', 1) } });

    expect(optimisticRead(cache)?.name).toBe('Milk');

    cache.removeOptimistic('write-1');
    cache.recordOptimisticTransaction(apply, 'write-1');

    expect(optimisticRead(cache)).toMatchObject({
      name: 'Oat milk',
      quantity: 5,
    });
  });

  it('hides the root’s later rows of a list it touched until it is re-added', () => {
    const cache = makeCache();
    cache.writeQuery({
      query: ROW_LIST,
      data: { probeRows: [row('Milk', 1)] },
    });
    const apply = (c: unknown) => {
      const proxy = c as ProbeCache;
      const held = proxy.readQuery<ProbeRowsData>({
        query: ROW_LIST,
        optimistic: true,
      });
      proxy.writeQuery({
        query: ROW_LIST,
        data: {
          probeRows: [...(held?.probeRows ?? []), row('Mine', 1, 'mine')],
        },
      });
    };
    cache.recordOptimisticTransaction(apply, 'write-1');

    cache.writeQuery({
      query: ROW_LIST,
      data: { probeRows: [row('Milk', 1), row('Theirs', 1, 'theirs')] },
    });

    const names = () =>
      cache
        .readQuery<ProbeRowsData>({ query: ROW_LIST, optimistic: true })
        ?.probeRows.map(({ name }) => name);
    expect(names()).toEqual(['Milk', 'Mine']);

    cache.removeOptimistic('write-1');
    cache.recordOptimisticTransaction(apply, 'write-1');

    expect(names()).toEqual(['Milk', 'Theirs', 'Mine']);
  });

  it('never reaches extract(), which holds the root', () => {
    const cache = seeded();
    cache.recordOptimisticTransaction(c => {
      setQuantity(c as ProbeCache, 5);
    }, 'write-1');

    expect(cache.extract()['ProbeItem:row-1']?.quantity).toBe(1);
    expect(cache.extract(true)['ProbeItem:row-1']?.quantity).toBe(5);
  });

  it('keeps a row only a layer names through gc', () => {
    const cache = seeded();
    cache.recordOptimisticTransaction(c => {
      (c as ProbeCache).writeQuery({
        query: ROW_LIST,
        data: { probeRows: [row('Mine', 1, 'mine')] },
      });
    }, 'write-1');

    cache.gc();

    expect(
      cache.readQuery<ProbeRowsData>({ query: ROW_LIST, optimistic: true })
        ?.probeRows,
    ).toHaveLength(1);
  });
});

describe('taking a row away inside a layer', () => {
  const held = (cache: ProbeCache, optimistic: boolean) =>
    cache.readFragment<{ quantity: number }>({
      id: 'ProbeItem:row-1',
      fragment: QUANTITY,
      optimistic,
    });

  it('evict does nothing to a row the layer does not hold', () => {
    const cache = seeded();

    cache.recordOptimisticTransaction(c => {
      c.evict({ id: 'ProbeItem:row-1' });
    }, 'write-1');

    expect(held(cache, true)).toMatchObject({ quantity: 1 });
  });

  it('modify with DELETE hides the row, and the root keeps it', () => {
    const cache = seeded();

    cache.recordOptimisticTransaction(c => {
      c.modify({
        id: 'ProbeItem:row-1',
        fields: (_value, { DELETE }) => DELETE,
      });
    }, 'write-1');

    expect(held(cache, true)).toBeNull();
    expect(held(cache, false)).toMatchObject({ quantity: 1 });
    expect(optimisticRead(cache)).toBeUndefined();

    cache.removeOptimistic('write-1');

    expect(held(cache, true)).toMatchObject({ quantity: 1 });
  });

  it('a list filtered in a layer leaves the root’s list whole', () => {
    const cache = makeCache();
    cache.writeQuery({
      query: ROW_LIST,
      data: { probeRows: [row('Milk', 1), row('Oat', 1, 'row-2')] },
    });

    cache.recordOptimisticTransaction(c => {
      c.modify<{ probeRows: readonly Reference[] }>({
        id: 'ROOT_QUERY',
        fields: {
          probeRows: (rows, { readField }) =>
            (rows as readonly Reference[]).filter(
              ref => readField('id', ref) !== 'row-2',
            ),
        },
      });
    }, 'write-1');

    const ids = (optimistic: boolean) =>
      cache
        .readQuery<ProbeRowsData>({ query: ROW_LIST, optimistic })
        ?.probeRows.map(({ id }) => id);
    expect(ids(true)).toEqual(['row-1']);
    expect(ids(false)).toEqual(['row-1', 'row-2']);
  });
});

describe('removing a layer', () => {
  it('replays the layers above it, in order, over what is left', () => {
    const cache = seeded();
    const applied: string[] = [];
    cache.recordOptimisticTransaction(c => {
      applied.push('first');
      setQuantity(c as ProbeCache, 2);
    }, 'first');
    cache.recordOptimisticTransaction(c => {
      applied.push('second');
      setQuantity(c as ProbeCache, 3);
    }, 'second');
    expect(applied).toEqual(['first', 'second']);

    cache.removeOptimistic('first');

    expect(applied).toEqual(['first', 'second', 'second']);
    expect(optimisticRead(cache)?.quantity).toBe(3);
  });

  it('removes every layer sharing its id', () => {
    const cache = seeded();
    cache.recordOptimisticTransaction(c => {
      setQuantity(c as ProbeCache, 2);
    }, 'generation-1');
    cache.recordOptimisticTransaction(c => {
      setQuantity(c as ProbeCache, 3);
    }, 'generation-1');

    cache.removeOptimistic('generation-1');

    expect(optimisticRead(cache)?.quantity).toBe(1);
  });
});

describe('changing layers around a batch', () => {
  const watching = (cache: ProbeCache) => {
    const seen: unknown[] = [];
    cache.watch<ProbeRowData>({
      query: ROW,
      optimistic: true,
      callback: diff => seen.push(diff.result?.probeRow),
    });
    return seen;
  };

  it('discards a layer added inside a batch’s update when the batch ends', () => {
    const cache = seeded();

    cache.batch({
      update: () => {
        cache.recordOptimisticTransaction(c => {
          setQuantity(c as ProbeCache, 5);
        }, 'write-1');
      },
    });

    expect(optimisticRead(cache)?.quantity).toBe(1);
  });

  it('restores a layer removed inside a batch’s update when the batch ends', () => {
    const cache = seeded();
    cache.recordOptimisticTransaction(c => {
      setQuantity(c as ProbeCache, 5);
    }, 'write-1');

    cache.batch({
      update: () => {
        cache.removeOptimistic('write-1');
      },
    });

    expect(optimisticRead(cache)?.quantity).toBe(5);
  });

  it('swaps one generation for the next with one notification', () => {
    const cache = seeded();
    cache.recordOptimisticTransaction(c => {
      setQuantity(c as ProbeCache, 2);
    }, 'generation-1');
    cache.recordOptimisticTransaction(c => {
      setQuantity(c as ProbeCache, 3);
    }, 'generation-1');
    cache.writeQuery({ query: ROW, data: { probeRow: row('Oat milk', 1) } });

    const seen = watching(cache);
    let runs = 0;
    cache.batch({
      optimistic: 'generation-2',
      removeOptimistic: 'generation-1',
      update: c => {
        runs += 1;
        setQuantity(c, 3);
      },
    });

    // Once over the old layers, and again over the root as they are removed.
    expect(runs).toBe(2);
    expect(seen).toEqual([row('Oat milk', 3)]);
    expect(optimisticRead(cache)).toMatchObject({
      name: 'Oat milk',
      quantity: 3,
    });
  });

  it('shows a watcher the layer’s copy after a write to the root', () => {
    const cache = seeded();
    cache.recordOptimisticTransaction(c => {
      setQuantity(c as ProbeCache, 5);
    }, 'write-1');
    const seen = watching(cache);

    cache.writeQuery({ query: ROW, data: { probeRow: row('Oat milk', 2) } });

    expect(seen).toEqual([row('Milk', 5)]);
  });
});
