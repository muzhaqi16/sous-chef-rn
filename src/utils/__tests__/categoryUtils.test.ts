import {
  getCategoriesForItem,
  getPrimaryCategoryForItem,
  getItemsByCategory,
  getAllCategories,
} from '../categoryUtils';

// Minimal Item-like objects for testing
function makeItem(categories?: Array<{ isPrimary?: boolean; category?: { name?: string } | null }>) {
  return { categories } as any;
}

describe('getCategoriesForItem', () => {
  it('returns category names', () => {
    const item = makeItem([
      { category: { name: 'Fruits' } },
      { category: { name: 'Organic' } },
    ]);
    expect(getCategoriesForItem(item)).toEqual(['Fruits', 'Organic']);
  });

  it('filters out null category names', () => {
    const item = makeItem([
      { category: { name: 'Fruits' } },
      { category: null },
      { category: { name: undefined } },
    ]);
    expect(getCategoriesForItem(item)).toEqual(['Fruits']);
  });

  it('returns empty array for null categories', () => {
    expect(getCategoriesForItem(makeItem(undefined))).toEqual([]);
  });

  it('returns empty array for null item', () => {
    expect(getCategoriesForItem(null as any)).toEqual([]);
  });
});

describe('getPrimaryCategoryForItem', () => {
  it('returns primary category name', () => {
    const item = makeItem([
      { isPrimary: false, category: { name: 'Fruits' } },
      { isPrimary: true, category: { name: 'Organic' } },
    ]);
    expect(getPrimaryCategoryForItem(item)).toBe('Organic');
  });

  it('falls back to first category when no primary', () => {
    const item = makeItem([
      { isPrimary: false, category: { name: 'Fruits' } },
      { isPrimary: false, category: { name: 'Organic' } },
    ]);
    expect(getPrimaryCategoryForItem(item)).toBe('Fruits');
  });

  it('returns null when no categories', () => {
    expect(getPrimaryCategoryForItem(makeItem(undefined))).toBeNull();
  });

  it('returns null for null item', () => {
    expect(getPrimaryCategoryForItem(null as any)).toBeNull();
  });
});

describe('getItemsByCategory', () => {
  const items = [
    makeItem([{ category: { name: 'Fruits' } }]),
    makeItem([{ category: { name: 'Dairy' } }]),
    makeItem([{ category: { name: 'Fruits' } }, { category: { name: 'Organic' } }]),
    makeItem(undefined), // no categories
  ];

  it('filters items by category name', () => {
    const result = getItemsByCategory(items, 'Fruits');
    expect(result).toHaveLength(2);
  });

  it('returns uncategorized items', () => {
    const result = getItemsByCategory(items, 'Uncategorized');
    expect(result).toHaveLength(1);
  });

  it('returns empty array for non-existent category', () => {
    expect(getItemsByCategory(items, 'NonExistent')).toHaveLength(0);
  });
});

describe('getAllCategories', () => {
  it('counts items per category', () => {
    const items = [
      makeItem([{ category: { name: 'Fruits' } }]),
      makeItem([{ category: { name: 'Fruits' } }]),
      makeItem([{ category: { name: 'Dairy' } }]),
    ];
    const categories = getAllCategories(items);
    expect(categories).toEqual([
      { id: 'Fruits', name: 'Fruits', itemCount: 2 },
      { id: 'Dairy', name: 'Dairy', itemCount: 1 },
    ]);
  });

  it('includes Uncategorized for items without categories', () => {
    const items = [
      makeItem(undefined),
      makeItem([{ category: { name: 'Fruits' } }]),
    ];
    const categories = getAllCategories(items);
    const uncategorized = categories.find(c => c.name === 'Uncategorized');
    expect(uncategorized).toBeDefined();
    expect(uncategorized!.itemCount).toBe(1);
  });

  it('sorts by item count descending', () => {
    const items = [
      makeItem([{ category: { name: 'A' } }]),
      makeItem([{ category: { name: 'B' } }]),
      makeItem([{ category: { name: 'B' } }]),
      makeItem([{ category: { name: 'B' } }]),
    ];
    const categories = getAllCategories(items);
    expect(categories[0].name).toBe('B');
    expect(categories[0].itemCount).toBe(3);
  });

  it('handles empty array', () => {
    expect(getAllCategories([])).toEqual([]);
  });
});
