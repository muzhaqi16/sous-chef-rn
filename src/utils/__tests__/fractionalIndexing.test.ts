import { generatePosition } from '../fractionalIndexing';

describe('generatePosition', () => {
  it('generates a position between null boundaries (first item)', () => {
    const pos = generatePosition(null, null);
    expect(typeof pos).toBe('string');
    expect(pos.length).toBeGreaterThan(0);
  });

  it('generates a position at the start (before first item)', () => {
    const first = generatePosition(null, null);
    const before = generatePosition(null, first);
    expect(before < first).toBe(true);
  });

  it('generates a position at the end (after last item)', () => {
    const last = generatePosition(null, null);
    const after = generatePosition(last, null);
    expect(after > last).toBe(true);
  });

  it('generates a position between two keys', () => {
    const a = generatePosition(null, null);
    const b = generatePosition(a, null);
    const between = generatePosition(a, b);
    expect(between > a).toBe(true);
    expect(between < b).toBe(true);
  });

  it('handles undefined as null (start boundary)', () => {
    const pos = generatePosition(undefined, null);
    expect(typeof pos).toBe('string');
  });

  it('handles undefined as null (end boundary)', () => {
    const pos = generatePosition(null, undefined);
    expect(typeof pos).toBe('string');
  });

  it('handles both undefined boundaries', () => {
    const pos = generatePosition(undefined, undefined);
    expect(typeof pos).toBe('string');
  });

  it('produces unique positions for consecutive inserts at the end', () => {
    const positions: string[] = [];
    let prev: string | null = null;
    for (let i = 0; i < 10; i++) {
      const pos = generatePosition(prev, null);
      positions.push(pos);
      prev = pos;
    }
    const unique = new Set(positions);
    expect(unique.size).toBe(10);
    // Verify they are in sorted order
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i] > positions[i - 1]).toBe(true);
    }
  });

  it('produces unique positions for consecutive inserts at the start', () => {
    const positions: string[] = [];
    let next: string | null = null;
    for (let i = 0; i < 10; i++) {
      const pos = generatePosition(null, next);
      positions.unshift(pos);
      next = pos;
    }
    // positions are now in sorted order (earliest inserted at end, latest at start)
    const unique = new Set(positions);
    expect(unique.size).toBe(10);
  });
});
