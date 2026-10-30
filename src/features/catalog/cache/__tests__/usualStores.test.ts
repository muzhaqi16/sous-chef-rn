import { makeCache } from '#/apollo/cache';
import { UsualStoreSource } from '#/graphql/generated/schemaTypes';
import {
  keepUsualStores,
  localUsualStore,
  readUsualStores,
  writeUsualStores,
  type UsualStoreEntry,
} from '../usualStores';

const entry = (
  id: string,
  store: { id: string; name: string; address?: string | null },
): UsualStoreEntry => ({
  __typename: 'UsualStore',
  id,
  addedVia: UsualStoreSource.Receipt,
  pinned: false,
  compared: true,
  lastUsedAt: '2026-10-20T12:00:00.000Z',
  store: {
    __typename: 'Store',
    address: null,
    chain: { __typename: 'StoreChain', id: 'chain-ge', name: 'Giant Eagle' },
    ...store,
  },
  chain: { __typename: 'StoreChain', id: 'chain-ge', name: 'Giant Eagle' },
});

const storeIds = (entries: UsualStoreEntry[] | null) =>
  entries?.map(each => each.store?.id);

describe('writeUsualStores', () => {
  it('replaces the list written before it', () => {
    const cache = makeCache();
    writeUsualStores(cache, 'home-1', [
      entry('home-1:s1', { id: 's1', name: 'Giant Eagle Banksville' }),
      entry('home-1:s2', { id: 's2', name: 'Giant Eagle Market District' }),
    ]);

    writeUsualStores(cache, 'home-1', [
      entry('home-1:s2', { id: 's2', name: 'Giant Eagle Market District' }),
    ]);

    expect(storeIds(readUsualStores(cache, 'home-1'))).toEqual(['s2']);
  });

  it('keeps each household its own list', () => {
    const cache = makeCache();
    writeUsualStores(cache, 'home-1', [
      entry('home-1:s1', { id: 's1', name: 'Giant Eagle Banksville' }),
    ]);
    writeUsualStores(cache, null, []);

    expect(storeIds(readUsualStores(cache, 'home-1'))).toEqual(['s1']);
    expect(readUsualStores(cache, null)).toEqual([]);
    expect(readUsualStores(cache, 'home-2')).toBeNull();
  });

  // A store picked offline is written before the server names its entry.
  it("takes the server's answer over a local list, with no store twice", () => {
    const cache = makeCache();
    writeUsualStores(cache, 'home-1', [
      entry('home-1:s1', { id: 's1', name: 'Giant Eagle Banksville' }),
    ]);
    const picked = localUsualStore(
      cache,
      { store: { id: 's2', name: 'ALDI Wilkinsburg' } },
      UsualStoreSource.Picked,
    );
    if (!picked) throw new Error('no local entry');
    const local = readUsualStores(cache, 'home-1') ?? [];
    writeUsualStores(cache, 'home-1', [...local, picked]);

    writeUsualStores(cache, 'home-1', [
      entry('home-1:s1', { id: 's1', name: 'Giant Eagle Banksville' }),
      entry('home-1:s2', { id: 's2', name: 'ALDI Wilkinsburg' }),
    ]);

    const answered = readUsualStores(cache, 'home-1');
    expect(storeIds(answered)).toEqual(['s1', 's2']);
    expect(answered?.map(each => each.id)).toEqual(['home-1:s1', 'home-1:s2']);
  });
});

describe('keepUsualStores', () => {
  // A refresh that landed after a local removal put the store back.
  it("keeps only the stores a removal's answer names", () => {
    const cache = makeCache();
    writeUsualStores(cache, 'home-1', [
      entry('home-1:s1', { id: 's1', name: 'Giant Eagle Banksville' }),
      entry('home-1:s2', { id: 's2', name: 'Giant Eagle Market District' }),
    ]);

    keepUsualStores(cache, 'home-1', ['home-1:s1']);

    expect(storeIds(readUsualStores(cache, 'home-1'))).toEqual(['s1']);
  });
});

describe('localUsualStore', () => {
  it('completes a store from what the cache holds, with its chain', () => {
    const cache = makeCache();
    writeUsualStores(cache, 'home-1', [
      entry('home-1:s1', {
        id: 's1',
        name: 'Giant Eagle Banksville',
        address: '1 Banksville Rd',
      }),
    ]);

    const learned = localUsualStore(
      cache,
      { store: { id: 's1', name: 'Giant Eagle Banksville' } },
      UsualStoreSource.Receipt,
    );

    expect(learned).toMatchObject({
      addedVia: UsualStoreSource.Receipt,
      pinned: false,
      compared: true,
      store: { name: 'Giant Eagle Banksville', address: '1 Banksville Rd' },
      chain: { name: 'Giant Eagle' },
    });
  });

  it('names a whole chain with no store', () => {
    const learned = localUsualStore(
      makeCache(),
      { chain: { id: 'chain-aldi', name: 'ALDI' } },
      UsualStoreSource.Picked,
    );

    expect(learned).toMatchObject({ store: null, chain: { name: 'ALDI' } });
  });
});
