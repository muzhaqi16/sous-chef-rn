import { renderHook } from '@testing-library/react-native';
import { useCategoryManagement } from '../useCategoryManagement';

// Mock generated types - Item is only used as a type
jest.mock('#generated', () => ({}));

// Mock categoryUtils with actual implementations for integration testing
jest.mock('#/utils/categoryUtils', () => ({
  getAllCategories: jest.fn((items: any[]) => {
    const categoryMap = new Map<string, number>();
    items.forEach((item: any) => {
      const cats = item.categories?.map((a: any) => a.category?.name).filter(Boolean) ?? [];
      if (cats.length === 0) {
        categoryMap.set('Uncategorized', (categoryMap.get('Uncategorized') || 0) + 1);
      } else {
        cats.forEach((name: string) => {
          categoryMap.set(name, (categoryMap.get(name) || 0) + 1);
        });
      }
    });
    return Array.from(categoryMap.entries())
      .map(([name, itemCount]) => ({ id: name, name, itemCount }))
      .sort((a, b) => b.itemCount - a.itemCount);
  }),
  getItemsByCategory: jest.fn((items: any[], categoryName: string) => {
    if (categoryName === 'Uncategorized') {
      return items.filter(
        (item: any) => !item.categories?.some((a: any) => a.category?.name),
      );
    }
    return items.filter((item: any) =>
      item.categories?.some((a: any) => a.category?.name === categoryName),
    );
  }),
  getCategoriesForItem: jest.fn((item: any) => {
    return item.categories?.map((a: any) => a.category?.name).filter(Boolean) ?? [];
  }),
  getPrimaryCategoryForItem: jest.fn((item: any) => {
    const primary = item.categories?.find((a: any) => a.isPrimary);
    if (primary?.category?.name) return primary.category.name;
    return item.categories?.[0]?.category?.name || null;
  }),
}));

function createItem(id: string, categories: Array<{ name: string; isPrimary?: boolean }> = []) {
  return {
    id,
    name: `Item ${id}`,
    categories: categories.map(cat => ({
      isPrimary: cat.isPrimary ?? false,
      category: { name: cat.name },
    })),
  } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useCategoryManagement', () => {
  it('returns empty categories for empty items', () => {
    const { result } = renderHook(() => useCategoryManagement([]));

    expect(result.current.categories).toEqual([]);
    expect(result.current.totalCategories).toBe(0);
  });

  it('returns categories with item counts', () => {
    const items = [
      createItem('1', [{ name: 'Dairy' }]),
      createItem('2', [{ name: 'Dairy' }]),
      createItem('3', [{ name: 'Produce' }]),
    ];

    const { result } = renderHook(() => useCategoryManagement(items));

    expect(result.current.categories).toHaveLength(2);
    expect(result.current.totalCategories).toBe(2);

    const dairy = result.current.categories.find((c: any) => c.name === 'Dairy');
    expect(dairy?.itemCount).toBe(2);

    const produce = result.current.categories.find((c: any) => c.name === 'Produce');
    expect(produce?.itemCount).toBe(1);
  });

  it('counts uncategorized items', () => {
    const items = [
      createItem('1', [{ name: 'Dairy' }]),
      createItem('2', []),
    ];

    const { result } = renderHook(() => useCategoryManagement(items));

    const uncategorized = result.current.categories.find(
      (c: any) => c.name === 'Uncategorized',
    );
    expect(uncategorized?.itemCount).toBe(1);
  });

  describe('getItemsByCategory', () => {
    it('filters items by category name', () => {
      const items = [
        createItem('1', [{ name: 'Dairy' }]),
        createItem('2', [{ name: 'Produce' }]),
        createItem('3', [{ name: 'Dairy' }]),
      ];

      const { result } = renderHook(() => useCategoryManagement(items));

      const dairyItems = result.current.getItemsByCategory('Dairy');
      expect(dairyItems).toHaveLength(2);
    });
  });

  describe('getCategoriesForItem', () => {
    it('returns categories for a known item ID', () => {
      const items = [
        createItem('1', [{ name: 'Dairy' }, { name: 'Refrigerated' }]),
      ];

      const { result } = renderHook(() => useCategoryManagement(items));

      const cats = result.current.getCategoriesForItem('1');
      expect(cats).toEqual(['Dairy', 'Refrigerated']);
    });

    it('returns empty array for unknown item ID', () => {
      const items = [createItem('1', [{ name: 'Dairy' }])];

      const { result } = renderHook(() => useCategoryManagement(items));

      const cats = result.current.getCategoriesForItem('unknown');
      expect(cats).toEqual([]);
    });
  });

  describe('getPrimaryCategoryForItem', () => {
    it('returns primary category when marked', () => {
      const items = [
        createItem('1', [
          { name: 'Dairy', isPrimary: true },
          { name: 'Refrigerated' },
        ]),
      ];

      const { result } = renderHook(() => useCategoryManagement(items));

      const primary = result.current.getPrimaryCategoryForItem('1');
      expect(primary).toBe('Dairy');
    });

    it('returns null for unknown item ID', () => {
      const items = [createItem('1', [{ name: 'Dairy' }])];

      const { result } = renderHook(() => useCategoryManagement(items));

      const primary = result.current.getPrimaryCategoryForItem('unknown');
      expect(primary).toBeNull();
    });
  });
});
