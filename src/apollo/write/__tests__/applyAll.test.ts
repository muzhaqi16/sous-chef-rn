import type { InMemoryCache } from '@apollo/client';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { adjustBy } from '../writeIntent';
import { useWrite } from '../useWrite';

/**
 * One mutation, several entities.
 *
 * A batch takes N rows out of a list in a single call, and a mutation carries
 * ONE context — so N separate `apply` calls would send only the last intent to
 * the queue and leave the rest applied with nothing able to undo them.
 */
const seeded = () =>
  seedCache([
    { __typename: 'ShoppingListItem', id: 'a' },
    { __typename: 'ShoppingListItem', id: 'b' },
    {
      __typename: 'ShoppingList',
      id: 'list-1',
      totalItems: 5,
      completedItems: 3,
    },
  ]);

const renderWrite = (cache: InMemoryCache) =>
  renderHookWithApollo(() => useWrite(), { cache });

const removal = (id: string) => ({
  target: { __typename: 'ShoppingListItem', id },
  lifecycle: 'remove' as const,
  patch: {},
  aggregates: [
    {
      target: { __typename: 'ShoppingList', id: 'list-1' },
      patch: { totalItems: adjustBy(-1), completedItems: adjustBy(-1) },
    },
  ],
  convergence: 'absolute' as const,
});

const list = (cache: InMemoryCache) =>
  cache.extract()['ShoppingList:list-1'] as Record<string, number>;

describe('useWrite().applyAll', () => {
  it('applies every intent and carries them all on one context', () => {
    const cache = seeded();
    const { result } = renderWrite(cache);

    const applied = result.current.applyAll([removal('a'), removal('b')]);

    expect(applied.intents).toHaveLength(2);
    expect(applied.context.writeIntents).toHaveLength(2);
    expect(cache.extract()['ShoppingListItem:a']).toBeUndefined();
    expect(cache.extract()['ShoppingListItem:b']).toBeUndefined();
    // Both aggregates moved — the defect a single-intent write would have had
    // is exactly one of the two counters being left behind.
    expect(list(cache).totalItems).toBe(3);
    expect(list(cache).completedItems).toBe(1);
  });

  it('reverting puts every entity back and undoes every aggregate', () => {
    const cache = seeded();
    const { result } = renderWrite(cache);

    const applied = result.current.applyAll([removal('a'), removal('b')]);
    applied.revert();

    expect(cache.extract()['ShoppingListItem:a']).toBeDefined();
    expect(cache.extract()['ShoppingListItem:b']).toBeDefined();
    expect(list(cache).totalItems).toBe(5);
    expect(list(cache).completedItems).toBe(3);
  });

  it('carries a single intent on the same shape as a batch', () => {
    // `apply` and `applyAll` differ only in count, so the queue reads one shape.
    const cache = seeded();
    const { result } = renderWrite(cache);

    const applied = result.current.apply({
      target: { __typename: 'ShoppingListItem', id: 'a' },
      patch: { itemName: 'renamed' },
      convergence: 'absolute',
    });

    expect(applied.context.writeIntents).toHaveLength(1);
  });
});
