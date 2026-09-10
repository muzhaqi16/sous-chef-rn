import { shouldUseServerSort } from '#features/pantry/utils/hybridSort';

describe('shouldUseServerSort', () => {
  const PAGE_SIZE = 50;

  it('returns true when online and totalCount exceeds pageSize', () => {
    expect(shouldUseServerSort(51, PAGE_SIZE, true)).toBe(true);
  });

  it('returns false when totalCount equals pageSize', () => {
    expect(shouldUseServerSort(50, PAGE_SIZE, true)).toBe(false);
  });

  it('returns false when totalCount is below pageSize', () => {
    expect(shouldUseServerSort(10, PAGE_SIZE, true)).toBe(false);
  });

  it('returns false when totalCount is 0 (initial load)', () => {
    expect(shouldUseServerSort(0, PAGE_SIZE, true)).toBe(false);
  });

  it('returns false when offline even if totalCount exceeds pageSize', () => {
    expect(shouldUseServerSort(100, PAGE_SIZE, false)).toBe(false);
  });

  it('returns false when offline and totalCount is below pageSize', () => {
    expect(shouldUseServerSort(10, PAGE_SIZE, false)).toBe(false);
  });
});
