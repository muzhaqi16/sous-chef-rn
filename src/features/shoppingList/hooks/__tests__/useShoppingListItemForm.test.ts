import { renderHook, act } from '@testing-library/react-native';
import { useShoppingListItemForm } from '../useShoppingListItemForm';
import type { UseShoppingListItemForm_ItemFragment } from '../useShoppingListItemForm.generated';

// Mock parseFractionalInput
jest.mock('#/utils/fractionUtils', () => ({
  parseFractionalInput: jest.fn((input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (trimmed === '1/2') return 0.5;
    if (trimmed === '1 1/4') return 1.25;
    const result = parseFloat(trimmed);
    return isNaN(result) ? null : result;
  }),
}));

describe('useShoppingListItemForm', () => {
  describe('initial state', () => {
    it('returns default form state', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      expect(result.current.formState).toEqual({
        itemName: '',
        quantityInput: '1',
        unit: '',
        selectedUnitId: null,
        notes: '',
        category: '',
        estimatedPrice: '',
      });
    });

    it('accepts initial state overrides', () => {
      const { result } = renderHook(() =>
        useShoppingListItemForm({
          itemName: 'Milk',
          quantityInput: '2',
        }),
      );

      expect(result.current.formState.itemName).toBe('Milk');
      expect(result.current.formState.quantityInput).toBe('2');
      expect(result.current.formState.unit).toBe(''); // not overridden
    });
  });

  describe('updateField', () => {
    it('updates a single field', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.updateField('itemName', 'Eggs');
      });

      expect(result.current.formState.itemName).toBe('Eggs');
    });

    it('preserves other fields when updating one', () => {
      const { result } = renderHook(() =>
        useShoppingListItemForm({ itemName: 'Milk', quantityInput: '2' }),
      );

      act(() => {
        result.current.updateField('category', 'Dairy');
      });

      expect(result.current.formState.itemName).toBe('Milk');
      expect(result.current.formState.quantityInput).toBe('2');
      expect(result.current.formState.category).toBe('Dairy');
    });
  });

  describe('setFromItem', () => {
    function createFragment(
      overrides: Partial<UseShoppingListItemForm_ItemFragment> = {},
    ): UseShoppingListItemForm_ItemFragment {
      return {
        __typename: 'ShoppingListItem',
        id: 'sli-1',
        version: 1,
        itemName: 'Butter',
        quantity: 2,
        quantityInput: '2',
        unitName: 'lb',
        notes: 'Unsalted',
        category: 'Dairy',
        unit: { __typename: 'Unit', id: 'unit-1' },
        priceEstimate: { __typename: 'PriceEstimate', estimated: 5.99 },
        ...overrides,
      };
    }

    it('populates form state from ShoppingListItemFragment', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFromItem(createFragment());
      });

      expect(result.current.formState.itemName).toBe('Butter');
      expect(result.current.formState.quantityInput).toBe('2');
      expect(result.current.formState.unit).toBe('lb');
      expect(result.current.formState.notes).toBe('Unsalted');
      expect(result.current.formState.category).toBe('Dairy');
      expect(result.current.formState.selectedUnitId).toBe('unit-1');
      expect(result.current.formState.estimatedPrice).toBe('5.99');
    });

    it('falls back to quantity string when quantityInput is missing', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFromItem(createFragment({ quantityInput: null }));
      });

      expect(result.current.formState.quantityInput).toBe('2');
    });

    it('defaults to "1" when both quantityInput and quantity are missing', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFromItem(
          createFragment({ quantityInput: null, quantity: null }),
        );
      });

      expect(result.current.formState.quantityInput).toBe('1');
    });

    it('handles missing unit', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFromItem(createFragment({ unit: null }));
      });

      expect(result.current.formState.selectedUnitId).toBeNull();
    });

    it('handles missing priceEstimate', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFromItem(
          createFragment({
            priceEstimate: { __typename: 'PriceEstimate', estimated: null },
          }),
        );
      });

      expect(result.current.formState.estimatedPrice).toBe('');
    });
  });

  describe('dirtyFields and hasDirtyFields', () => {
    it('returns all false when no initial state saved', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      expect(result.current.hasDirtyFields).toBe(false);
      expect(result.current.dirtyFields.itemName).toBe(false);
    });

    it('detects dirty fields after setFromItem + change', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFromItem({
          __typename: 'ShoppingListItem',
          id: 'sli-1',
          version: 1,
          itemName: 'Milk',
          quantity: 1,
          quantityInput: '1',
          unitName: '',
          notes: '',
          category: '',
          unit: null,
          priceEstimate: { __typename: 'PriceEstimate', estimated: null },
        });
      });

      // No changes yet
      expect(result.current.hasDirtyFields).toBe(false);

      // Make a change
      act(() => {
        result.current.updateField('itemName', 'Whole Milk');
      });

      expect(result.current.dirtyFields.itemName).toBe(true);
      expect(result.current.hasDirtyFields).toBe(true);
      // Other fields should not be dirty
      expect(result.current.dirtyFields.quantityInput).toBe(false);
    });
  });

  describe('buildUnitInput', () => {
    it('returns nested unit object from form state', () => {
      const { result } = renderHook(() =>
        useShoppingListItemForm({ unit: 'gallon' }),
      );

      expect(result.current.buildUnitInput()).toEqual({
        unit: { unitName: 'gallon' },
      });
    });

    it('includes unitId when selectedUnitId is set', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.updateField('unit', 'gallon');
        result.current.updateField('selectedUnitId', 'unit-123');
      });

      expect(result.current.buildUnitInput()).toEqual({
        unit: { unitName: 'gallon', unitId: 'unit-123' },
      });
    });

    it('returns empty object when no unit data', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      expect(result.current.buildUnitInput()).toEqual({});
    });
  });

  describe('buildDirtyInput', () => {
    it('returns empty object when nothing is dirty', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFromItem({
          __typename: 'ShoppingListItem',
          id: 'sli-1',
          version: 1,
          itemName: 'Milk',
          quantity: 1,
          quantityInput: '1',
          unitName: '',
          notes: '',
          category: '',
          unit: null,
          priceEstimate: { __typename: 'PriceEstimate', estimated: null },
        });
      });

      expect(result.current.buildDirtyInput()).toEqual({});
    });

    it('includes only changed fields', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFromItem({
          __typename: 'ShoppingListItem',
          id: 'sli-1',
          version: 1,
          itemName: 'Milk',
          quantity: 1,
          quantityInput: '1',
          unitName: '',
          notes: '',
          category: 'Dairy',
          unit: null,
          priceEstimate: { __typename: 'PriceEstimate', estimated: null },
        });
      });

      act(() => {
        result.current.updateField('itemName', 'Whole Milk');
        result.current.updateField('category', 'Beverages');
      });

      const dirty = result.current.buildDirtyInput();
      expect(dirty.itemName).toBe('Whole Milk');
      expect(dirty.category).toBe('Beverages');
      expect(dirty).not.toHaveProperty('notes');
    });

    it('sends quantityInput as raw string under "quantity" key', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFromItem({
          __typename: 'ShoppingListItem',
          id: 'sli-1',
          version: 1,
          itemName: 'Milk',
          quantity: 1,
          quantityInput: '1',
          unitName: '',
          notes: '',
          category: '',
          unit: null,
          priceEstimate: { __typename: 'PriceEstimate', estimated: null },
        });
      });

      act(() => {
        result.current.updateField('quantityInput', '1/2');
      });

      const dirty = result.current.buildDirtyInput();
      expect(dirty.quantity).toBe('1/2');
    });

    it('includes estimatedPrice as float when dirty', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFromItem({
          __typename: 'ShoppingListItem',
          id: 'sli-1',
          version: 1,
          itemName: 'Milk',
          quantity: 1,
          quantityInput: '1',
          unitName: '',
          notes: '',
          category: '',
          unit: null,
          priceEstimate: { __typename: 'PriceEstimate', estimated: null },
        });
      });

      act(() => {
        result.current.updateField('estimatedPrice', '4.99');
      });

      const dirty = result.current.buildDirtyInput();
      expect(dirty.pricing).toEqual({ estimatedPrice: 4.99 });
    });
  });

  describe('parseQuantityInput', () => {
    it('parses integer input', () => {
      const { result } = renderHook(() =>
        useShoppingListItemForm({ quantityInput: '3' }),
      );

      expect(result.current.parseQuantityInput()).toBe(3);
    });

    it('parses fractional input', () => {
      const { result } = renderHook(() =>
        useShoppingListItemForm({ quantityInput: '1/2' }),
      );

      expect(result.current.parseQuantityInput()).toBe(0.5);
    });

    it('returns null for invalid input', () => {
      const { result } = renderHook(() =>
        useShoppingListItemForm({ quantityInput: 'abc' }),
      );

      expect(result.current.parseQuantityInput()).toBeNull();
    });

    it('returns null for zero quantity', () => {
      const { result } = renderHook(() =>
        useShoppingListItemForm({ quantityInput: '0' }),
      );

      expect(result.current.parseQuantityInput()).toBeNull();
    });

    it('returns null for negative quantity', () => {
      const { result } = renderHook(() =>
        useShoppingListItemForm({ quantityInput: '-1' }),
      );

      expect(result.current.parseQuantityInput()).toBeNull();
    });
  });
});
