import { renderHook, act, waitFor } from '@testing-library/react-native';
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

      expect(result.current.values).toEqual({
        itemName: '',
        quantityInput: '1',
        unit: '',
        selectedUnitId: null,
        notes: '',
        category: '',
        estimatedPrice: '',
        priority: 0,
        storeId: null,
        storeName: '',
        brand: '',
        brandId: null,
        netWeight: '',
        netWeightUnit: '',
        netWeightUnitId: null,
      });
    });

    it('accepts initial state overrides', () => {
      const { result } = renderHook(() =>
        useShoppingListItemForm({
          itemName: 'Milk',
          quantityInput: '2',
        }),
      );

      expect(result.current.values.itemName).toBe('Milk');
      expect(result.current.values.quantityInput).toBe('2');
      expect(result.current.values.unit).toBe(''); // not overridden
    });
  });

  describe('updateField', () => {
    it('updates a single field', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFieldValue('itemName', 'Eggs');
      });

      expect(result.current.values.itemName).toBe('Eggs');
    });

    it('preserves other fields when updating one', () => {
      const { result } = renderHook(() =>
        useShoppingListItemForm({ itemName: 'Milk', quantityInput: '2' }),
      );

      act(() => {
        result.current.setFieldValue('category', 'Dairy');
      });

      expect(result.current.values.itemName).toBe('Milk');
      expect(result.current.values.quantityInput).toBe('2');
      expect(result.current.values.category).toBe('Dairy');
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
        priority: 0,
        storeInfo: {
          __typename: 'ShoppingListItemStoreInfo',
          preferredStore: null,
        },
        brand: null,
        netWeight: null,
        netWeightUnit: null,
        ...overrides,
      };
    }

    it('populates form state from ShoppingListItemFragment', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFromItem(createFragment());
      });

      expect(result.current.values.itemName).toBe('Butter');
      expect(result.current.values.quantityInput).toBe('2');
      expect(result.current.values.unit).toBe('lb');
      expect(result.current.values.notes).toBe('Unsalted');
      expect(result.current.values.category).toBe('Dairy');
      expect(result.current.values.selectedUnitId).toBe('unit-1');
      expect(result.current.values.estimatedPrice).toBe('5.99');
    });

    it('falls back to quantity string when quantityInput is missing', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFromItem(createFragment({ quantityInput: null }));
      });

      expect(result.current.values.quantityInput).toBe('2');
    });

    it('defaults to "1" when both quantityInput and quantity are missing', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFromItem(
          createFragment({ quantityInput: null, quantity: null }),
        );
      });

      expect(result.current.values.quantityInput).toBe('1');
    });

    it('handles missing unit', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFromItem(createFragment({ unit: null }));
      });

      expect(result.current.values.selectedUnitId).toBeNull();
    });

    it('populates brand and net weight from the item', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFromItem(
          createFragment({
            brand: { __typename: 'Brand', id: 'brand-1', name: 'Oatly' },
            netWeight: 500,
            netWeightUnit: {
              __typename: 'Unit',
              id: 'unit-g',
              name: 'gram',
              symbol: 'g',
            },
          }),
        );
      });

      expect(result.current.values).toEqual(
        expect.objectContaining({
          brand: 'Oatly',
          brandId: 'brand-1',
          netWeight: '500',
          netWeightUnit: 'g',
          netWeightUnitId: 'unit-g',
        }),
      );
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

      expect(result.current.values.estimatedPrice).toBe('');
    });
  });

  describe('dirtyFields and hasDirtyFields', () => {
    it('returns all false when no initial state saved', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      expect(result.current.hasDirtyFields).toBe(false);
      // react-hook-form OMITS clean fields rather than marking them `false`;
      // `buildDirtyInput` reads them for truthiness, so the behaviour is the
      // same and this is the honest assertion of the new shape.
      expect(result.current.dirtyFields.itemName).toBeUndefined();
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
          priority: 0,
          storeInfo: {
            __typename: 'ShoppingListItemStoreInfo',
            preferredStore: null,
          },
          brand: null,
          netWeight: null,
          netWeightUnit: null,
        });
      });

      // No changes yet
      expect(result.current.hasDirtyFields).toBe(false);

      // Make a change
      act(() => {
        result.current.setFieldValue('itemName', 'Whole Milk');
      });

      expect(result.current.dirtyFields.itemName).toBe(true);
      expect(result.current.hasDirtyFields).toBe(true);
      // Other fields should not be dirty — react-hook-form omits clean keys.
      expect(result.current.dirtyFields.quantityInput).toBeUndefined();
    });

    // `storeName` is the display label for `storeId` and no submit path sends
    // it. On react-hook-form's whole-form `isDirty` an edit to it alone fired
    // `updateShoppingListItem` with an empty input.
    it('does not count storeName, which no submit path sends', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFieldValue('storeName', 'Corner Shop');
      });

      // Never marked dirty at all — excluded in `setFieldValue`, not
      // subtracted afterwards.
      expect(result.current.dirtyFields.storeName).toBeUndefined();
      expect(result.current.hasDirtyFields).toBe(false);
      expect(result.current.buildDirtyInput()).toEqual({});
    });

    it('counts storeId, which is sent', () => {
      const { result } = renderHook(() => useShoppingListItemForm());

      act(() => {
        result.current.setFieldValue('storeId', 'store-1');
      });

      expect(result.current.hasDirtyFields).toBe(true);
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
        result.current.setFieldValue('unit', 'gallon');
        result.current.setFieldValue('selectedUnitId', 'unit-123');
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
          priority: 0,
          storeInfo: {
            __typename: 'ShoppingListItemStoreInfo',
            preferredStore: null,
          },
          brand: null,
          netWeight: null,
          netWeightUnit: null,
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
          priority: 0,
          storeInfo: {
            __typename: 'ShoppingListItemStoreInfo',
            preferredStore: null,
          },
          brand: null,
          netWeight: null,
          netWeightUnit: null,
        });
      });

      act(() => {
        result.current.setFieldValue('itemName', 'Whole Milk');
        result.current.setFieldValue('category', 'Beverages');
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
          priority: 0,
          storeInfo: {
            __typename: 'ShoppingListItemStoreInfo',
            preferredStore: null,
          },
          brand: null,
          netWeight: null,
          netWeightUnit: null,
        });
      });

      act(() => {
        result.current.setFieldValue('quantityInput', '1/2');
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
          priority: 0,
          storeInfo: {
            __typename: 'ShoppingListItemStoreInfo',
            preferredStore: null,
          },
          brand: null,
          netWeight: null,
          netWeightUnit: null,
        });
      });

      act(() => {
        result.current.setFieldValue('estimatedPrice', '4.99');
      });

      const dirty = result.current.buildDirtyInput();
      expect(dirty.pricing).toEqual({ estimatedPrice: 4.99 });
    });
  });

  describe('buildDirtyInput — brand and net weight', () => {
    const seed = (
      overrides: Partial<UseShoppingListItemForm_ItemFragment> = {},
    ) => {
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
          priority: 0,
          storeInfo: {
            __typename: 'ShoppingListItemStoreInfo',
            preferredStore: null,
          },
          brand: { __typename: 'Brand', id: 'brand-1', name: 'Oatly' },
          netWeight: 500,
          netWeightUnit: {
            __typename: 'Unit',
            id: 'unit-g',
            name: 'gram',
            symbol: 'g',
          },
          ...overrides,
        });
      });
      return result;
    };

    it('sends a picked brand by id', () => {
      const result = seed();
      act(() => {
        result.current.setFieldValue('brandId', 'brand-2');
        result.current.setFieldValue('brand', 'Chobani');
      });
      expect(result.current.buildDirtyInput().brand).toEqual({
        brandId: 'brand-2',
      });
    });

    it('sends a typed brand by name so the server can find-or-create it', () => {
      const result = seed();
      act(() => {
        // Free typing clears the picked id, as BrandAutocompleteField does.
        result.current.setFieldValue('brandId', null);
        result.current.setFieldValue('brand', 'Chobani');
      });
      expect(result.current.buildDirtyInput().brand).toEqual({
        brandName: 'Chobani',
      });
    });

    it('removes the brand with an explicit null id when cleared', () => {
      const result = seed();
      act(() => {
        result.current.setFieldValue('brandId', null);
        result.current.setFieldValue('brand', '');
      });
      expect(result.current.buildDirtyInput().brand).toEqual({ brandId: null });
    });

    it('leaves brand and net weight out when they did not change', () => {
      const result = seed();
      act(() => {
        result.current.setFieldValue('notes', 'changed');
      });
      const dirty = result.current.buildDirtyInput();
      expect(dirty).not.toHaveProperty('brand');
      expect(dirty).not.toHaveProperty('netWeight');
    });

    it('sends the net weight with its unit when either changes', () => {
      const result = seed();
      act(() => {
        result.current.setFieldValue('netWeight', '750');
      });
      expect(result.current.buildDirtyInput().netWeight).toEqual({
        netWeight: 750,
        netWeightUnitId: 'unit-g',
      });
    });

    it('clears the net weight with an explicit null when emptied', () => {
      const result = seed();
      act(() => {
        result.current.setFieldValue('netWeight', '');
      });
      expect(result.current.buildDirtyInput().netWeight).toEqual({
        netWeight: null,
      });
    });

    it('reports a net weight typed with no unit on the UNIT field', async () => {
      // All-or-nothing: the API rejects a weight with no unit. The rule lives
      // in the yup schema, so it surfaces as a field error rather than an
      // alert the screen has to raise.
      const result = seed({ netWeight: null, netWeightUnit: null });
      act(() => {
        result.current.setFieldValue('netWeight', '250');
      });

      await waitFor(() => {
        expect(result.current.errors.netWeightUnit?.message).toBe(
          'Please select a unit for the net weight.',
        );
      });
      expect(result.current.parseNetWeightInput()).toBe(250);
    });

    it('clears that message once a unit is picked', async () => {
      const result = seed({ netWeight: null, netWeightUnit: null });
      act(() => {
        result.current.setFieldValue('netWeight', '250');
      });
      await waitFor(() => {
        expect(result.current.errors.netWeightUnit).toBeDefined();
      });

      act(() => {
        result.current.setFieldValue('netWeightUnitId', 'unit-g');
      });

      await waitFor(() => {
        expect(result.current.errors.netWeightUnit).toBeUndefined();
      });
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

  describe('buildDirtyPatch', () => {
    // The entity-shaped twin of buildDirtyInput. Both describe the same edit,
    // and every field they disagree about is a place the two can drift.
    type Edit = Parameters<
      ReturnType<typeof useShoppingListItemForm>['setFieldValue']
    >;

    const edited = (
      initial: Parameters<typeof useShoppingListItemForm>[0],
      edits: Edit[],
    ) => {
      const { result } = renderHook(() => useShoppingListItemForm(initial));
      act(() => {
        edits.forEach(([field, value]) => {
          result.current.setFieldValue(field, value);
        });
      });
      return result;
    };

    it('writes a normalized field as a ref, never an object literal', () => {
      // The kit shallow-merges object values, so merging onto an existing
      // `{ __ref }` leaves the ref in place and the change is lost on read.
      const result = edited({ unit: 'kg' }, [
        ['unit', 'g'],
        ['selectedUnitId', 'unit-9'],
      ]);

      const patch = result.current.buildDirtyPatch();

      expect(patch.unit).toEqual({ __ref: 'Unit:unit-9' });
      expect(patch.unitName).toBe('g');
    });

    it('carries both the parsed number and the string the person typed', () => {
      const result = edited({ quantityInput: '1' }, [
        ['quantityInput', '1 1/4'],
      ]);

      const patch = result.current.buildDirtyPatch();

      expect(patch.quantity).toBe(1.25);
      expect(patch.quantityInput).toBe('1 1/4');
    });

    it('clears a brand locally but leaves a typed name to the server', () => {
      // A name the server has to resolve (and may create) has no id to point
      // at, so there is no honest local value to write.
      const cleared = edited({ brand: 'Acme' }, [['brand', '']]);
      expect(cleared.current.buildDirtyPatch().brand).toBeNull();

      const typed = edited({ brand: '' }, [['brand', 'Newco']]);
      expect(typed.current.buildDirtyPatch()).not.toHaveProperty('brand');
    });

    it('clears a net weight and its unit together', () => {
      const result = edited({ netWeight: '500', netWeightUnitId: 'unit-1' }, [
        ['netWeight', ''],
      ]);

      const patch = result.current.buildDirtyPatch();

      expect(patch.netWeight).toBeNull();
      expect(patch.netWeightUnit).toBeNull();
    });

    it('is empty when nothing was edited', () => {
      const { result } = renderHook(() =>
        useShoppingListItemForm({ itemName: 'Milk' }),
      );
      expect(result.current.buildDirtyPatch()).toEqual({});
    });
  });
});
