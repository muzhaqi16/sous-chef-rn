import { createPropsComparator } from '../memoUtils';

interface TestProps {
  isActive: boolean;
  count: number;
  item: {
    id: string;
    name: string;
    config?: { value: number; unit: string };
  };
  onPress: () => void;
}

describe('memoUtils', () => {
  describe('createPropsComparator', () => {
    it('returns true when all reference keys match', () => {
      const compare = createPropsComparator<TestProps>({
        referenceKeys: ['isActive', 'count'],
      });
      const props = { isActive: true, count: 5, item: { id: '1', name: 'A' }, onPress: () => {} };
      expect(compare(props, props)).toBe(true);
    });

    it('returns false when a reference key differs', () => {
      const compare = createPropsComparator<TestProps>({
        referenceKeys: ['isActive', 'count'],
      });
      const prev = { isActive: true, count: 5, item: { id: '1', name: 'A' }, onPress: () => {} };
      const next = { ...prev, count: 6 };
      expect(compare(prev, next)).toBe(false);
    });

    it('compares nested object fields by value', () => {
      const compare = createPropsComparator<TestProps>({
        nestedComparisons: { item: ['id', 'name'] },
      });
      const prev = { isActive: true, count: 1, item: { id: '1', name: 'A' }, onPress: () => {} };
      const next = { ...prev, item: { id: '1', name: 'A' } };
      expect(compare(prev, next)).toBe(true);
    });

    it('returns false when nested field differs', () => {
      const compare = createPropsComparator<TestProps>({
        nestedComparisons: { item: ['id', 'name'] },
      });
      const prev = { isActive: true, count: 1, item: { id: '1', name: 'A' }, onPress: () => {} };
      const next = { ...prev, item: { id: '1', name: 'B' } };
      expect(compare(prev, next)).toBe(false);
    });

    it('handles deep nested paths with dot notation', () => {
      const compare = createPropsComparator<TestProps>({
        nestedComparisons: { 'item.config': ['value', 'unit'] },
      });
      const prev = {
        isActive: true,
        count: 1,
        item: { id: '1', name: 'A', config: { value: 10, unit: 'kg' } },
        onPress: () => {},
      };
      const next = {
        ...prev,
        item: { ...prev.item, config: { value: 10, unit: 'kg' } },
      };
      expect(compare(prev, next)).toBe(true);
    });

    it('returns false when deep nested field differs', () => {
      const compare = createPropsComparator<TestProps>({
        nestedComparisons: { 'item.config': ['value'] },
      });
      const prev = {
        isActive: true,
        count: 1,
        item: { id: '1', name: 'A', config: { value: 10, unit: 'kg' } },
        onPress: () => {},
      };
      const next = {
        ...prev,
        item: { ...prev.item, config: { value: 20, unit: 'kg' } },
      };
      expect(compare(prev, next)).toBe(false);
    });

    it('handles both null nested values as equal', () => {
      const compare = createPropsComparator<TestProps>({
        nestedComparisons: { 'item.config': ['value'] },
      });
      const prev = { isActive: true, count: 1, item: { id: '1', name: 'A' }, onPress: () => {} };
      const next = { ...prev, item: { id: '1', name: 'A' } };
      expect(compare(prev, next)).toBe(true);
    });

    it('returns false when one nested value is null and other is not', () => {
      const compare = createPropsComparator<TestProps>({
        nestedComparisons: { 'item.config': ['value'] },
      });
      const prev = {
        isActive: true,
        count: 1,
        item: { id: '1', name: 'A', config: { value: 10, unit: 'kg' } },
        onPress: () => {},
      };
      const next = {
        ...prev,
        item: { id: '1', name: 'A' },
      };
      expect(compare(prev, next)).toBe(false);
    });

    it('combines reference and nested comparisons', () => {
      const compare = createPropsComparator<TestProps>({
        referenceKeys: ['isActive'],
        nestedComparisons: { item: ['id'] },
      });
      const fn = () => {};
      const prev = { isActive: true, count: 1, item: { id: '1', name: 'A' }, onPress: fn };
      const next = { isActive: true, count: 99, item: { id: '1', name: 'Z' }, onPress: fn };
      expect(compare(prev, next)).toBe(true);
    });

    it('returns true for empty config', () => {
      const compare = createPropsComparator<TestProps>({});
      const prev = { isActive: true, count: 1, item: { id: '1', name: 'A' }, onPress: () => {} };
      const next = { ...prev, count: 99 };
      expect(compare(prev, next)).toBe(true);
    });
  });
});
