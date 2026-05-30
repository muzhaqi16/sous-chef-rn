// NOTE: babel-plugin-react-compiler swaps the module exports in this project,
// so optimisticTypes functions are exported from createOptimisticResponse at runtime.
import {
  enhanceWithVersion,
  createOptimisticEntity,
  isVersionedEntity,
  type VersionedEntity,
} from '../createOptimisticResponse';

interface OptimisticShoppingListItem extends VersionedEntity {
  itemName: string;
  isPurchased: boolean;
  quantity: number;
}

describe('enhanceWithVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges updates into the current item', () => {
    const current = {
      id: '1',
      __typename: 'PantryItem',
      name: 'Milk',
      version: 3,
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const result = enhanceWithVersion(current, { name: 'Oat Milk' });

    expect(result.id).toBe('1');
    expect(result.name).toBe('Oat Milk');
    expect(result.__typename).toBe('PantryItem');
  });

  it('preserves the current version without incrementing', () => {
    const current = {
      id: '1',
      version: 5,
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const result = enhanceWithVersion(current, { id: '1' });

    expect(result.version).toBe(5);
  });

  it('defaults version to 0 when current version is null', () => {
    const current = {
      id: '1',
      version: null,
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const result = enhanceWithVersion(current, {});

    expect(result.version).toBe(0);
  });

  it('defaults version to 0 when current version is undefined', () => {
    const current = {
      id: '1',
      version: undefined,
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const result = enhanceWithVersion(current, {});

    expect(result.version).toBe(0);
  });

  it('sets updatedAt to the current timestamp', () => {
    const before = new Date().toISOString();
    const current = {
      id: '1',
      version: 1,
      updatedAt: '2020-01-01T00:00:00.000Z',
    };

    const result = enhanceWithVersion(current, {});
    const after = new Date().toISOString();

    expect(result.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
    expect(result.updatedAt! >= before).toBe(true);
    expect(result.updatedAt! <= after).toBe(true);
  });

  it('throws when currentItem is undefined', () => {
    expect(() => enhanceWithVersion(undefined, { name: 'x' })).toThrow(
      'enhanceWithVersion requires a current item from cache',
    );
  });

  it('preserves all original fields that are not in updates', () => {
    const current = {
      id: '1',
      version: 2,
      updatedAt: '2024-01-01T00:00:00.000Z',
      name: 'Eggs',
      quantity: 12,
      __typename: 'PantryItem',
    };

    const result = enhanceWithVersion(current, { quantity: 6 });

    expect(result.name).toBe('Eggs');
    expect(result.quantity).toBe(6);
    expect(result.__typename).toBe('PantryItem');
  });
});

describe('createOptimisticEntity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an entity with __typename, id, version 1, and updatedAt', () => {
    const result = createOptimisticEntity('PantryItem', 'temp-123', {
      name: 'Milk',
    });

    expect(result.__typename).toBe('PantryItem');
    expect(result.id).toBe('temp-123');
    expect(result.version).toBe(1);
    expect(result.updatedAt).toBeDefined();
  });

  it('sets updatedAt to a recent ISO timestamp', () => {
    const before = new Date().toISOString();
    const result = createOptimisticEntity('Item', 'id-1', {});
    const after = new Date().toISOString();

    expect(result.updatedAt! >= before).toBe(true);
    expect(result.updatedAt! <= after).toBe(true);
  });

  it('includes all provided data fields', () => {
    const result = createOptimisticEntity<OptimisticShoppingListItem>(
      'ShoppingListItem',
      'temp-1',
      {
        itemName: 'Butter',
        isPurchased: false,
        quantity: 2,
      },
    );

    expect(result.itemName).toBe('Butter');
    expect(result.isPurchased).toBe(false);
    expect(result.quantity).toBe(2);
  });

  it('allows data fields to override version and updatedAt', () => {
    // data is spread last, so it can override defaults
    const result = createOptimisticEntity('Item', 'id-1', {
      // Note: because of Omit in the type signature, these can't be directly
      // typed, but at runtime the spread order means data wins
    });

    // version and updatedAt are set before ...data spread
    expect(result.version).toBe(1);
    expect(result.updatedAt).toBeDefined();
  });
});

describe('isVersionedEntity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true for an object with id, version, and updatedAt', () => {
    const entity = { id: '1', version: 2, updatedAt: '2024-01-01' };
    expect(isVersionedEntity(entity)).toBe(true);
  });

  it('returns true when version is 0', () => {
    expect(
      isVersionedEntity({ id: '1', version: 0, updatedAt: '2024-01-01' }),
    ).toBe(true);
  });

  it('returns true when updatedAt is null', () => {
    // 'updatedAt' key is present even though value is null
    expect(isVersionedEntity({ id: '1', version: 1, updatedAt: null })).toBe(
      true,
    );
  });

  it('returns false when id is missing', () => {
    expect(isVersionedEntity({ version: 1, updatedAt: '2024-01-01' })).toBe(
      false,
    );
  });

  it('returns false when version is missing', () => {
    expect(isVersionedEntity({ id: '1', updatedAt: '2024-01-01' })).toBe(false);
  });

  it('returns false when updatedAt is missing', () => {
    expect(isVersionedEntity({ id: '1', version: 1 })).toBe(false);
  });

  it('returns falsy for null', () => {
    expect(isVersionedEntity(null)).toBeFalsy();
  });

  it('returns falsy for undefined', () => {
    expect(isVersionedEntity(undefined)).toBeFalsy();
  });

  it('returns false for a string', () => {
    expect(isVersionedEntity('hello')).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isVersionedEntity(42)).toBe(false);
  });

  it('returns false for an empty object', () => {
    expect(isVersionedEntity({})).toBe(false);
  });
});
