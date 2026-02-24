import { parseFractionalInput } from '../fractionUtils';

describe('parseFractionalInput', () => {
  describe('integers', () => {
    it('parses single digit', () => {
      expect(parseFractionalInput('1')).toBe(1);
    });

    it('parses multi-digit', () => {
      expect(parseFractionalInput('10')).toBe(10);
    });

    it('parses zero', () => {
      expect(parseFractionalInput('0')).toBe(0);
    });
  });

  describe('decimals', () => {
    it('parses decimal with leading zero', () => {
      expect(parseFractionalInput('0.25')).toBe(0.25);
    });

    it('parses decimal without leading zero', () => {
      expect(parseFractionalInput('.5')).toBe(0.5);
    });

    it('parses decimal greater than 1', () => {
      expect(parseFractionalInput('1.5')).toBe(1.5);
    });
  });

  describe('simple fractions', () => {
    it('parses 1/2', () => {
      expect(parseFractionalInput('1/2')).toBe(0.5);
    });

    it('parses 3/4', () => {
      expect(parseFractionalInput('3/4')).toBe(0.75);
    });

    it('parses 1/3', () => {
      expect(parseFractionalInput('1/3')).toBeCloseTo(0.333, 2);
    });
  });

  describe('mixed numbers', () => {
    it('parses 1 1/4', () => {
      expect(parseFractionalInput('1 1/4')).toBe(1.25);
    });

    it('parses 2 1/2', () => {
      expect(parseFractionalInput('2 1/2')).toBe(2.5);
    });

    it('parses 3 3/4', () => {
      expect(parseFractionalInput('3 3/4')).toBe(3.75);
    });
  });

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(parseFractionalInput('')).toBeNull();
    });

    it('returns null for whitespace only', () => {
      expect(parseFractionalInput('   ')).toBeNull();
    });

    it('returns null for non-numeric text', () => {
      expect(parseFractionalInput('abc')).toBeNull();
    });

    it('returns null for division by zero', () => {
      expect(parseFractionalInput('1/0')).toBeNull();
    });

    it('returns null for malformed fraction', () => {
      expect(parseFractionalInput('1/2/3')).toBeNull();
    });

    it('returns null for mixed number with bad fraction', () => {
      expect(parseFractionalInput('1 2/0')).toBeNull();
    });

    it('trims leading/trailing whitespace', () => {
      expect(parseFractionalInput('  1/2  ')).toBe(0.5);
    });

    it('returns null for too many space-separated groups', () => {
      expect(parseFractionalInput('1 2 3/4')).toBeNull();
    });
  });
});
