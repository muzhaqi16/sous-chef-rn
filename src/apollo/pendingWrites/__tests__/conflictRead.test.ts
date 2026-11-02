import { makeCache } from '#/apollo/cache';
import { seedFragment } from '#/test-utils/apolloMockProvider';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  PantryItemConflict_PantryItemFragmentDoc,
  type PantryItemConflict_PantryItemFragment,
} from '#features/pantry/offline/pantryItemConflict.generated';
import { updateRow } from '#features/shoppingList/offline/localWrites';
import { conflictOutcome } from '../conflictRead';
import { pendingWritesOf } from '../pendingWrites';

describe('conflictOutcome', () => {
  it('reads every changed field holding what was sent as landed', () => {
    expect(
      conflictOutcome(
        { notes: 'mine', quantity: 2 },
        { notes: 'old', quantity: 1 },
        { notes: 'mine', quantity: 2, itemName: 'moved on' },
      ),
    ).toBe('landed');
  });

  it('merges when no field the write changed has moved', () => {
    expect(
      conflictOutcome(
        { notes: 'mine' },
        { notes: 'old' },
        { notes: 'old', itemName: 'moved on' },
      ),
    ).toBe('merge');
  });

  it('merges when one field landed and the other has not moved', () => {
    expect(
      conflictOutcome(
        { notes: 'mine', quantity: 2 },
        { notes: 'old', quantity: 1 },
        { notes: 'mine', quantity: 1 },
      ),
    ).toBe('merge');
  });

  it('clashes when a field holds neither side', () => {
    expect(
      conflictOutcome({ notes: 'mine' }, { notes: 'old' }, { notes: 'theirs' }),
    ).toBe('clash');
  });

  it('clashes with no baseline, unless it landed', () => {
    expect(
      conflictOutcome({ notes: 'mine' }, undefined, { notes: 'old' }),
    ).toBe('clash');
    expect(
      conflictOutcome({ notes: 'mine' }, undefined, { notes: 'mine' }),
    ).toBe('landed');
  });

  it('clashes on a field the row does not state', () => {
    expect(conflictOutcome({ nope: 1 }, { nope: 1 }, { notes: 'x' })).toBe(
      'clash',
    );
  });

  it('clashes when nothing can be compared', () => {
    expect(
      conflictOutcome(
        { updatedAt: 'now' },
        {},
        { notes: 'x', updatedAt: 'now' },
      ),
    ).toBe('clash');
  });

  it('skips what the device stamps or the server restates', () => {
    expect(
      conflictOutcome(
        { quantity: 2, quantityInput: '2', updatedAt: 'now' },
        { quantity: 1 },
        { quantity: 2, quantityInput: '2.000', updatedAt: 'earlier' },
      ),
    ).toBe('landed');
  });

  it('compares a nested record by id, whatever else it carries', () => {
    expect(
      conflictOutcome(
        { brand: { __typename: 'Brand', id: 'b1', name: 'Typed' } },
        { brand: null },
        { brand: { __typename: 'Brand', id: 'b1', version: 2 } },
      ),
    ).toBe('landed');
  });

  it('compares a record with no id by what the write set', () => {
    expect(
      conflictOutcome(
        { storeInfo: { preferredStore: { id: 's1' } } },
        {},
        {
          storeInfo: {
            __typename: 'ShoppingListItemStoreInfo',
            preferredStore: { __typename: 'Store', id: 's1' },
          },
        },
      ),
    ).toBe('landed');
  });

  it('reads blank, empty and absent as the same', () => {
    expect(conflictOutcome({ notes: '' }, {}, { notes: null })).toBe('landed');
  });

  it('compares a list in order', () => {
    expect(
      conflictOutcome({ tags: ['a', 'b'] }, { tags: [] }, { tags: ['b', 'a'] }),
    ).toBe('clash');
  });
});

describe('the changed fields of a shopping edit', () => {
  it('states a tick in the row’s own shape', () => {
    const changed = updateRow.conflict?.changed({
      purchase: { listId: 'list-1', isPurchased: true, now: 'now' },
    });

    expect(
      conflictOutcome(
        changed ?? {},
        { purchaseInfo: { isPurchased: false } },
        {
          purchaseInfo: { __typename: 'PurchaseInfo', isPurchased: true },
        },
      ),
    ).toBe('landed');
  });
});

describe('a write’s baseline', () => {
  const edit = (id: string, storageNotes: string) => ({
    document: UpdatePantryItemDocument,
    variables: { input: { id, version: 3, storageNotes } },
    given: {
      entity: { __typename: 'PantryItem', id },
      fields: { storageNotes },
    },
  });

  const cacheHolding = () => {
    const cache = makeCache();
    seedFragment(cache, {
      id: cache.identify({ __typename: 'PantryItem', id: 'item-1' }),
      fragment: PantryItemConflict_PantryItemFragmentDoc,
      data: {
        __typename: 'PantryItem',
        id: 'item-1',
        version: 3,
        storageNotes: 'as loaded',
      },
    });
    return cache;
  };

  const baselineOf = (inputs: Readonly<Record<string, unknown>>) =>
    inputs.baseline as PantryItemConflict_PantryItemFragment;

  it('is the row as the person saw it, before the write', () => {
    const write = edit('item-1', 'mine');

    const { inputs } = pendingWritesOf(cacheHolding()).begin(
      write.document,
      write.variables,
      write.given,
    );

    expect(baselineOf(inputs).storageNotes).toBe('as loaded');
  });

  it('shows an earlier pending write, which is what the person saw', () => {
    const writes = pendingWritesOf(cacheHolding());
    const first = edit('item-1', 'first edit');
    const second = edit('item-1', 'second edit');
    writes.begin(first.document, first.variables, first.given);

    const { inputs } = writes.begin(
      second.document,
      second.variables,
      second.given,
    );

    expect(baselineOf(inputs).storageNotes).toBe('first edit');
  });

  it('survives the queue’s JSON', () => {
    const write = edit('item-1', 'mine');

    const { inputs } = pendingWritesOf(cacheHolding()).begin(
      write.document,
      write.variables,
      write.given,
    );

    expect(baselineOf(JSON.parse(JSON.stringify(inputs))).storageNotes).toBe(
      'as loaded',
    );
  });

  it('is absent for a row the device does not hold', () => {
    const write = edit('item-unknown', 'mine');

    const { inputs } = pendingWritesOf(makeCache()).begin(
      write.document,
      write.variables,
      write.given,
    );

    expect(inputs.baseline).toBeUndefined();
  });
});
