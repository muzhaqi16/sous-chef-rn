import {
  MAX_PAGINATION_LIMIT,
  PAGE_SIZE,
  MAX_QUERY_DEPTH,
  MAX_QUERY_FIELDS,
  capPagination,
  validatePagination,
} from '../pagination';

describe('pagination constants', () => {
  it('exports MAX_PAGINATION_LIMIT as 100', () => {
    expect(MAX_PAGINATION_LIMIT).toBe(100);
  });

  it('exports PAGE_SIZE with expected keys', () => {
    expect(PAGE_SIZE.COMPACT).toBe(15);
    expect(PAGE_SIZE.DEFAULT).toBe(25);
    expect(PAGE_SIZE.SCROLL).toBe(30);
    expect(PAGE_SIZE.EXTENDED).toBe(50);
    expect(PAGE_SIZE.MAX).toBe(100);
  });

  it('exports MAX_QUERY_DEPTH as 10', () => {
    expect(MAX_QUERY_DEPTH).toBe(10);
  });

  it('exports MAX_QUERY_FIELDS as 150', () => {
    expect(MAX_QUERY_FIELDS).toBe(150);
  });
});

describe('capPagination', () => {
  it('returns undefined when value is undefined', () => {
    expect(capPagination(undefined)).toBeUndefined();
  });

  it('returns the value when it is below the limit', () => {
    expect(capPagination(50)).toBe(50);
  });

  it('returns the value when it equals the limit', () => {
    expect(capPagination(100)).toBe(100);
  });

  it('caps the value at the limit when it exceeds it', () => {
    expect(capPagination(500)).toBe(100);
    expect(capPagination(200)).toBe(100);
  });

  it('handles zero', () => {
    expect(capPagination(0)).toBe(0);
  });

  it('handles negative values', () => {
    expect(capPagination(-10)).toBe(-10);
  });
});

describe('validatePagination', () => {
  it('caps all pagination params', () => {
    const result = validatePagination({
      first: 500,
      last: 200,
      limit: 50,
      take: 150,
    });

    expect(result).toEqual({
      first: 100,
      last: 100,
      limit: 50,
      take: 100,
    });
  });

  it('returns undefined for missing params', () => {
    const result = validatePagination({});
    expect(result).toEqual({
      first: undefined,
      last: undefined,
      limit: undefined,
      take: undefined,
    });
  });

  it('preserves values under the limit', () => {
    const result = validatePagination({
      first: 20,
      last: 30,
    });
    expect(result.first).toBe(20);
    expect(result.last).toBe(30);
    expect(result.limit).toBeUndefined();
    expect(result.take).toBeUndefined();
  });
});
