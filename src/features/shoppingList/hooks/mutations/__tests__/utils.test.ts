import { createOptimisticShoppingListItem } from '../utils';

// Mock generateId to return predictable values
jest.mock('#/utils/generateId', () => ({
  generateId: jest.fn(() => 'mock-uuid-123'),
}));

// Mock createOptimisticEntity to return a structured entity
jest.mock('#/apollo/utils/createOptimisticResponse', () => ({
  createOptimisticEntity: jest.fn(
    (typename: string, id: string, fields: Record<string, unknown>) => ({
      __typename: typename,
      id,
      ...fields,
    }),
  ),
}));

// Mock createRemoveFromParentConnectionUpdater used by removeFromShoppingListItemsCache
jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

function getEntity(fields: { itemName: string; [key: string]: unknown }) {
  return createOptimisticShoppingListItem(fields).entity;
}

describe('createOptimisticShoppingListItem', () => {
  it('creates entity with temp ID prefix', () => {
    const result = createOptimisticShoppingListItem({
      itemName: 'Milk',
    });

    expect(result.tempId).toBe('temp-mock-uuid-123');
    expect(result.entity.id).toBe('temp-mock-uuid-123');
    expect(result.entity.__typename).toBe('ShoppingListItem');
  });

  it('includes itemName in entity', () => {
    const entity = getEntity({ itemName: 'Eggs' });
    expect(entity.itemName).toBe('Eggs');
  });

  it('defaults quantity to 1 when not provided', () => {
    const entity = getEntity({ itemName: 'Bread' });
    expect(entity.quantity).toBe(1);
  });

  it('uses provided quantity', () => {
    const entity = getEntity({ itemName: 'Bread', quantity: 3 });
    expect(entity.quantity).toBe(3);
  });

  it('defaults optional fields to null and displayFormat to AUTO', () => {
    const entity = getEntity({ itemName: 'Bread' });

    expect(entity.quantityInput).toBeNull();
    expect(entity.unitName).toBeNull();
    expect(entity.category).toBeNull();
    expect(entity.notes).toBeNull();
    expect(entity.displayFormat).toBe('AUTO');
  });

  it('includes provided optional fields', () => {
    const entity = getEntity({
      itemName: 'Milk',
      quantity: 2,
      quantityInput: '2',
      unitName: 'gallon',
      category: 'Dairy',
    });

    expect(entity.quantityInput).toBe('2');
    expect(entity.unitName).toBe('gallon');
    expect(entity.category).toBe('Dairy');
  });

  it('sets purchaseInfo with isPurchased: false', () => {
    const entity = getEntity({ itemName: 'Bread' });

    expect(entity.purchaseInfo).toEqual({
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: false,
    });
  });

  it('creates item reference when itemId is provided', () => {
    const entity = getEntity({ itemName: 'Milk', itemId: 'item-456' });

    expect(entity.item).toEqual({
      __typename: 'Item',
      id: 'item-456',
      imageUrl: null,
      images: [],
    });
  });

  it('sets item to null when itemId is not provided', () => {
    const entity = getEntity({ itemName: 'Milk' });
    expect(entity.item).toBeNull();
  });

  it('creates unit reference when unitId is provided', () => {
    const entity = getEntity({ itemName: 'Milk', unitId: 'unit-789' });

    expect(entity.unit).toEqual({
      __typename: 'Unit',
      id: 'unit-789',
      name: '',
      symbol: '',
    });
  });

  it('sets unit to null when unitId is not provided', () => {
    const entity = getEntity({ itemName: 'Milk' });
    expect(entity.unit).toBeNull();
  });

  it('sets sortOrder to empty string', () => {
    const entity = getEntity({ itemName: 'Milk' });
    expect(entity.sortOrder).toBe('');
  });
});
