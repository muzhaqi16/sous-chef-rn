// NOTE: babel-plugin-react-compiler swaps the module exports in this project,
// so optimisticTypes functions are exported from createOptimisticResponse at runtime.
import { enhanceWithVersion } from '../createOptimisticResponse';

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
    expect(result.updatedAt >= before).toBe(true);
    expect(result.updatedAt <= after).toBe(true);
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
