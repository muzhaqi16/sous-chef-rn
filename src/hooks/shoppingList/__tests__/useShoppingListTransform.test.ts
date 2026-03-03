import { renderHook } from '@testing-library/react-native';
import {
  useShoppingListTransform,
  useShoppingListTransformMulti,
} from '../useShoppingListTransform';

// Mock image utils
jest.mock('#utils/imageUtils', () => ({
  resolveImageUrl: (item: any) =>
    item?.imageUrl ? `https://cdn.test/${item.imageUrl}` : null,
}));

// Mock settings hook
let mockShowImages = true;
jest.mock('#hooks/settings/useUserPreferences', () => ({
  useShowShoppingListImages: () => mockShowImages,
}));

// Factory for ShoppingListItemDisplayFragment-like objects
function createDisplayItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    itemName: 'Milk',
    quantity: 2,
    quantityInput: '2',
    unitName: 'gallon',
    unit: { symbol: 'gal' },
    category: 'Dairy',
    sortOrder: 'aaa',
    imageUrl: 'milk.jpg',
    purchaseInfo: { isPurchased: false },
    ...overrides,
  } as any;
}

beforeEach(() => {
  mockShowImages = true;
});

describe('useShoppingListTransform', () => {
  it('transforms items to SortableShoppingListItem format', () => {
    const items = [createDisplayItem()];
    const { result } = renderHook(() => useShoppingListTransform(items));

    expect(result.current.sortableItems).toHaveLength(1);
    const item = result.current.sortableItems[0];
    expect(item.id).toBe('item-1');
    expect(item.title).toBe('Milk');
    expect(item.subtitle).toBe('Dairy');
    expect(item.sortOrder).toBe('aaa');
    expect(item.isPurchased).toBe(false);
  });

  it('creates quantity config as rightElementConfig', () => {
    const items = [createDisplayItem()];
    const { result } = renderHook(() => useShoppingListTransform(items));

    const item = result.current.sortableItems[0]!;
    const config = item.rightElementConfig!;
    expect(config.type).toBe('quantity');
    expect(config.quantity).toBe(2);
    expect(config.quantityInput).toBe('2');
    expect(config.unit).toBe('gallon');
    expect(config.itemId).toBe('item-1');
    expect(config.disabled).toBe(false);
  });

  it('falls back to unit.symbol when unitName is missing', () => {
    const items = [createDisplayItem({ unitName: null })];
    const { result } = renderHook(() => useShoppingListTransform(items));

    expect(result.current.sortableItems[0]!.rightElementConfig!.unit).toBe('gal');
  });

  it('creates image config as leftElementConfig when images enabled', () => {
    const items = [createDisplayItem()];
    const { result } = renderHook(() => useShoppingListTransform(items));

    const config = result.current.sortableItems[0]!.leftElementConfig;
    expect(config).toBeDefined();
    expect(config!.type).toBe('image');
    expect(config!.url).toBe('https://cdn.test/milk.jpg');
  });

  it('omits leftElementConfig when images are disabled', () => {
    mockShowImages = false;
    const items = [createDisplayItem()];
    const { result } = renderHook(() => useShoppingListTransform(items));

    expect(result.current.sortableItems[0].leftElementConfig).toBeUndefined();
  });

  it('omits leftElementConfig when item has no image', () => {
    const items = [createDisplayItem({ imageUrl: null })];
    const { result } = renderHook(() => useShoppingListTransform(items));

    expect(result.current.sortableItems[0].leftElementConfig).toBeUndefined();
  });

  it('partitions items by purchase status', () => {
    const items = [
      createDisplayItem({ id: '1', purchaseInfo: { isPurchased: false } }),
      createDisplayItem({ id: '2', purchaseInfo: { isPurchased: true } }),
      createDisplayItem({ id: '3', purchaseInfo: { isPurchased: false } }),
    ];
    const { result } = renderHook(() => useShoppingListTransform(items));

    expect(result.current.unpurchasedItems).toHaveLength(2);
    expect(result.current.purchasedItems).toHaveLength(1);
    expect(result.current.purchasedItems[0].id).toBe('2');
  });

  it('applies forcePurchasedState to override server value', () => {
    const items = [
      createDisplayItem({ id: '1', purchaseInfo: { isPurchased: false } }),
    ];
    const { result } = renderHook(() =>
      useShoppingListTransform(items, { forcePurchasedState: true }),
    );

    expect(result.current.sortableItems[0].isPurchased).toBe(true);
    expect(result.current.purchasedItems).toHaveLength(1);
    expect(result.current.unpurchasedItems).toHaveLength(0);
  });

  it('filters out items without id', () => {
    const items = [
      createDisplayItem({ id: null }),
      createDisplayItem({ id: '2' }),
    ];
    const { result } = renderHook(() => useShoppingListTransform(items));

    expect(result.current.sortableItems).toHaveLength(1);
    expect(result.current.sortableItems[0].id).toBe('2');
  });

  it('filters out items without itemName', () => {
    const items = [
      createDisplayItem({ itemName: null }),
      createDisplayItem({ id: '2', itemName: 'Valid' }),
    ];
    const { result } = renderHook(() => useShoppingListTransform(items));

    expect(result.current.sortableItems).toHaveLength(1);
    expect(result.current.sortableItems[0].title).toBe('Valid');
  });

  it('uses "zzz" as default sortOrder when missing', () => {
    const items = [createDisplayItem({ sortOrder: null })];
    const { result } = renderHook(() => useShoppingListTransform(items));

    expect(result.current.sortableItems[0].sortOrder).toBe('zzz');
  });

  it('defaults quantity to 0 when missing', () => {
    const items = [createDisplayItem({ quantity: null })];
    const { result } = renderHook(() => useShoppingListTransform(items));

    expect(result.current.sortableItems[0]!.rightElementConfig!.quantity).toBe(0);
  });

  it('handles empty items array', () => {
    const { result } = renderHook(() => useShoppingListTransform([]));

    expect(result.current.sortableItems).toHaveLength(0);
    expect(result.current.unpurchasedItems).toHaveLength(0);
    expect(result.current.purchasedItems).toHaveLength(0);
  });
});

describe('useShoppingListTransformMulti', () => {
  it('transforms unpurchased and purchased source arrays', () => {
    const unpurchased = [createDisplayItem({ id: '1' })];
    const purchased = [
      createDisplayItem({ id: '2', purchaseInfo: { isPurchased: true } }),
    ];

    const { result } = renderHook(() =>
      useShoppingListTransformMulti({
        rawUnpurchasedItems: unpurchased,
        rawPurchasedItems: purchased,
      }),
    );

    expect(result.current.unpurchasedItems).toHaveLength(1);
    expect(result.current.purchasedItems).toHaveLength(1);
  });

  it('forces isPurchased: false on unpurchasedItems', () => {
    const unpurchased = [
      createDisplayItem({ id: '1', purchaseInfo: { isPurchased: true } }),
    ];

    const { result } = renderHook(() =>
      useShoppingListTransformMulti({
        rawUnpurchasedItems: unpurchased,
        rawPurchasedItems: [],
      }),
    );

    // forcePurchasedState: false overrides the server value
    expect(result.current.unpurchasedItems[0]!.isPurchased).toBe(false);
  });

  it('forces isPurchased: true on purchasedItems', () => {
    const purchased = [
      createDisplayItem({ id: '1', purchaseInfo: { isPurchased: false } }),
    ];

    const { result } = renderHook(() =>
      useShoppingListTransformMulti({
        rawUnpurchasedItems: [],
        rawPurchasedItems: purchased,
      }),
    );

    // forcePurchasedState: true overrides the server value
    expect(result.current.purchasedItems[0]!.isPurchased).toBe(true);
  });
});
