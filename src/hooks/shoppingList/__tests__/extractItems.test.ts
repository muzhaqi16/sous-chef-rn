'use no memo';

import { extractItems } from '../usePaginatedShoppingItems';

// Minimal edge factory matching ItemEdge shape
function makeEdge(id: string, itemName: string) {
  return {
    __typename: 'ShoppingListItemEdge',
    node: {
      __typename: 'ShoppingListItem',
      id,
      itemName,
    },
  };
}

describe('extractItems structural stability', () => {
  it('returns EMPTY_ITEMS for null/undefined/empty edges', () => {
    const a = extractItems(null);
    const b = extractItems(undefined);
    const c = extractItems([]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toEqual([]);
  });

  it('returns same reference for same edge array identity (WeakMap cache)', () => {
    const edges = [makeEdge('1', 'Milk'), makeEdge('2', 'Bread')] as any;
    const first = extractItems(edges);
    const second = extractItems(edges);
    expect(first).toBe(second);
  });

  it('returns same reference when edges share the same node objects', () => {
    const node1 = { __typename: 'ShoppingListItem', id: '1', itemName: 'Milk' };
    const node2 = {
      __typename: 'ShoppingListItem',
      id: '2',
      itemName: 'Bread',
    };
    const edges1 = [
      { __typename: 'ShoppingListItemEdge', node: node1 },
      { __typename: 'ShoppingListItemEdge', node: node2 },
    ] as any;
    const edges2 = [
      { __typename: 'ShoppingListItemEdge', node: node1 },
      { __typename: 'ShoppingListItemEdge', node: node2 },
    ] as any;

    const first = extractItems(edges1);
    const second = extractItems(edges2);
    // Same node object references → stable reference
    expect(first).toBe(second);
  });

  it('returns new reference when node objects differ (e.g. quantity update)', () => {
    const edges1 = [makeEdge('1', 'Milk'), makeEdge('2', 'Bread')] as any;
    const first = extractItems(edges1);

    // Simulate Apollo creating new node objects after a mutation updates a field
    const edges2 = [makeEdge('1', 'Milk'), makeEdge('2', 'Bread')] as any;
    const second = extractItems(edges2);

    // Different node object references → new array so UI picks up changes
    expect(first).not.toBe(second);
    expect(second).toStrictEqual(first);
  });

  it('returns new reference when node IDs change', () => {
    const edges1 = [makeEdge('1', 'Milk'), makeEdge('2', 'Bread')] as any;
    const edges2 = [makeEdge('1', 'Milk'), makeEdge('3', 'Eggs')] as any;

    const first = extractItems(edges1);
    const second = extractItems(edges2);
    expect(first).not.toBe(second);
    expect(second).toHaveLength(2);
    expect(second[1].id).toBe('3');
  });

  it('returns new reference when order changes', () => {
    const edges1 = [makeEdge('1', 'Milk'), makeEdge('2', 'Bread')] as any;
    const edges2 = [makeEdge('2', 'Bread'), makeEdge('1', 'Milk')] as any;

    const first = extractItems(edges1);
    const second = extractItems(edges2);
    expect(first).not.toBe(second);
  });

  it('filters out edges with missing node id or itemName', () => {
    const edges = [
      makeEdge('1', 'Milk'),
      {
        __typename: 'ShoppingListItemEdge',
        node: { __typename: 'ShoppingListItem', id: '', itemName: 'Bad' },
      },
      {
        __typename: 'ShoppingListItemEdge',
        node: { __typename: 'ShoppingListItem', id: '3', itemName: '' },
      },
      makeEdge('4', 'Eggs'),
    ] as any;

    const result = extractItems(edges);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('4');
  });
});
