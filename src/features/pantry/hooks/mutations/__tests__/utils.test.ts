jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

import {
  buildOptimisticUnit,
  buildDirtyUpdateInput,
  addToPantryItemsCache,
} from '../utils';
import type { UnitSelection, FormDataInput } from '../types';
import { StorageState, UnitType } from '#/graphql/generated/schemaTypes';

type CurrentUnit = NonNullable<Parameters<typeof buildOptimisticUnit>[1]>;

const { createAddToParentConnectionUpdater } = jest.requireMock(
  '#/apollo/utils/cacheUpdaters',
) as { createAddToParentConnectionUpdater: jest.Mock };

describe('pantry mutations utils', () => {
  describe('addToPantryItemsCache', () => {
    it('is created via createAddToParentConnectionUpdater with correct args', () => {
      expect(createAddToParentConnectionUpdater).toHaveBeenCalledWith(
        'Pantry',
        'itemsConnection',
        'PantryItem',
      );
    });

    it('is a callable function', () => {
      expect(typeof addToPantryItemsCache).toBe('function');
    });
  });

  describe('buildOptimisticUnit', () => {
    it('returns null when newUnit has no id', () => {
      const newUnit: UnitSelection = {
        id: null,
        name: null,
        symbol: null,
        type: null,
      };
      const result = buildOptimisticUnit(newUnit);
      expect(result).toBeNull();
    });

    it('builds unit with newUnit fields when provided', () => {
      const newUnit: UnitSelection = {
        id: 'unit-1',
        name: 'Kilogram',
        symbol: 'kg',
        type: 'WEIGHT',
      };

      const result = buildOptimisticUnit(newUnit);

      expect(result).toEqual(
        expect.objectContaining({
          __typename: 'Unit',
          id: 'unit-1',
          name: 'Kilogram',
          symbol: 'kg',
          type: 'WEIGHT',
        }),
      );
    });

    it('falls back to currentUnit fields when newUnit fields are null', () => {
      const newUnit: UnitSelection = {
        id: 'unit-2',
        name: null,
        symbol: null,
        type: null,
      };
      const currentUnit: CurrentUnit = {
        __typename: 'Unit',
        id: 'unit-1',
        name: 'Gram',
        symbol: 'g',
        type: UnitType.Weight,
        isMetric: true,
        baseUnitId: 'base-1',
        conversionFactor: 0.001,
        isCommon: true,
        displayAsFraction: false,
        minPrecision: 2,
        autoConvertThreshold: 1000,
      };

      const result = buildOptimisticUnit(newUnit, currentUnit);

      expect(result).toEqual(
        expect.objectContaining({
          id: 'unit-2',
          name: 'Gram',
          symbol: 'g',
          type: 'WEIGHT',
          isMetric: true,
          baseUnitId: 'base-1',
          conversionFactor: 0.001,
          isCommon: true,
          displayAsFraction: false,
          minPrecision: 2,
          autoConvertThreshold: 1000,
        }),
      );
    });

    it('uses COUNT as default type when no type provided', () => {
      const newUnit: UnitSelection = {
        id: 'unit-3',
        name: 'Each',
        symbol: 'ea',
        type: null,
      };

      const result = buildOptimisticUnit(newUnit);

      expect(result?.type).toBe('COUNT');
    });

    it('uses symbol as name fallback when name is null', () => {
      const newUnit: UnitSelection = {
        id: 'unit-4',
        name: null,
        symbol: 'oz',
        type: 'WEIGHT',
      };

      const result = buildOptimisticUnit(newUnit);

      expect(result?.name).toBe('oz');
    });

    it('preserves defaults when no currentUnit provided', () => {
      const newUnit: UnitSelection = {
        id: 'unit-5',
        name: 'Liter',
        symbol: 'L',
        type: 'VOLUME',
      };

      const result = buildOptimisticUnit(newUnit);

      expect(result?.isMetric).toBe(false);
      expect(result?.baseUnitId).toBeNull();
      expect(result?.conversionFactor).toBe(1);
      expect(result?.isCommon).toBe(false);
      expect(result?.displayAsFraction).toBe(false);
      expect(result?.minPrecision).toBe(0);
      expect(result?.autoConvertThreshold).toBeNull();
    });
  });

  describe('buildDirtyUpdateInput', () => {
    const baseFormData: FormDataInput = {
      itemName: 'Milk',
      storageState: 'PANTRY' as StorageState,
      location: 'Fridge',
      expirationDate: new Date('2026-06-01'),
      notes: 'Whole milk',
      category: 'Dairy',
      unit: 'L',
      tags: ['organic'],
      minQuantity: '2',
      restockQuantity: '5',
      netWeight: '1.5',
      netWeightUnitId: 'nw-unit-1',
      brand: 'Organic Valley',
    };

    it('returns empty object when no fields are dirty', () => {
      const result = buildDirtyUpdateInput(baseFormData, {}, null, null);
      expect(result).toEqual({});
    });

    it('includes itemName when dirty', () => {
      const result = buildDirtyUpdateInput(
        baseFormData,
        { itemName: true },
        null,
        null,
      );
      expect(result).toEqual({ itemName: 'Milk' });
    });

    it('includes storageState when dirty', () => {
      const result = buildDirtyUpdateInput(
        baseFormData,
        { storageState: true },
        null,
        null,
      );
      expect(result).toEqual({ storage: { storageState: 'PANTRY' } });
    });

    it('includes storageLocationId when location is dirty and locationId provided', () => {
      const result = buildDirtyUpdateInput(
        baseFormData,
        { location: true },
        'loc-1',
        null,
      );
      expect(result).toEqual({ storage: { storageLocationId: 'loc-1' } });
    });

    it('sends storageLocationName when location is dirty with a typed name but no id (server find-or-creates by name)', () => {
      const result = buildDirtyUpdateInput(
        baseFormData,
        { location: true },
        null,
        null,
      );
      expect(result).toEqual({
        storage: { storageLocationName: 'Fridge' },
      });
    });

    it('includes expiresAt as ISO string when dirty', () => {
      const result = buildDirtyUpdateInput(
        baseFormData,
        { expirationDate: true },
        null,
        null,
      );
      expect(result).toEqual({ expiresAt: '2026-06-01T00:00:00.000Z' });
    });

    it('includes null expiresAt when date is undefined', () => {
      const formData = { ...baseFormData, expirationDate: undefined };
      const result = buildDirtyUpdateInput(
        formData,
        { expirationDate: true },
        null,
        null,
      );
      expect(result).toEqual({ expiresAt: null });
    });

    it('includes notes when dirty', () => {
      const result = buildDirtyUpdateInput(
        baseFormData,
        { notes: true },
        null,
        null,
      );
      expect(result).toEqual({ storage: { storageNotes: 'Whole milk' } });
    });

    it('includes tags when dirty', () => {
      const result = buildDirtyUpdateInput(
        baseFormData,
        { tags: true },
        null,
        null,
      );
      expect(result).toEqual({ tags: ['organic'] });
    });

    it('defaults tags to empty array when undefined', () => {
      const formData = { ...baseFormData, tags: undefined };
      const result = buildDirtyUpdateInput(
        formData,
        { tags: true },
        null,
        null,
      );
      expect(result).toEqual({ tags: [] });
    });

    it('includes minQuantity as float when dirty', () => {
      const result = buildDirtyUpdateInput(
        baseFormData,
        { minQuantity: true },
        null,
        null,
      );
      expect(result).toEqual({ thresholds: { minQuantity: 2 } });
    });

    it('sets minQuantity to null when empty string', () => {
      const formData = { ...baseFormData, minQuantity: '' };
      const result = buildDirtyUpdateInput(
        formData,
        { minQuantity: true },
        null,
        null,
      );
      expect(result).toEqual({ thresholds: { minQuantity: null } });
    });

    it('includes restockQuantity as float when dirty', () => {
      const result = buildDirtyUpdateInput(
        baseFormData,
        { restockQuantity: true },
        null,
        null,
      );
      expect(result).toEqual({ thresholds: { restockQuantity: 5 } });
    });

    it('sets restockQuantity to null when empty string', () => {
      const formData = { ...baseFormData, restockQuantity: '' };
      const result = buildDirtyUpdateInput(
        formData,
        { restockQuantity: true },
        null,
        null,
      );
      expect(result).toEqual({ thresholds: { restockQuantity: null } });
    });

    it('includes netWeight as float when dirty', () => {
      const result = buildDirtyUpdateInput(
        baseFormData,
        { netWeight: true },
        null,
        null,
      );
      expect(result).toEqual({ netWeight: { netWeight: 1.5 } });
    });

    it('sets netWeight to null when empty string', () => {
      const formData = { ...baseFormData, netWeight: '' };
      const result = buildDirtyUpdateInput(
        formData,
        { netWeight: true },
        null,
        null,
      );
      expect(result).toEqual({ netWeight: { netWeight: null } });
    });

    it('includes netWeightUnitId when dirty', () => {
      const result = buildDirtyUpdateInput(
        baseFormData,
        { netWeightUnitId: true },
        null,
        null,
      );
      expect(result).toEqual({ netWeight: { netWeightUnitId: 'nw-unit-1' } });
    });

    it('sets netWeightUnitId to null when empty', () => {
      const formData = { ...baseFormData, netWeightUnitId: '' };
      const result = buildDirtyUpdateInput(
        formData,
        { netWeightUnitId: true },
        null,
        null,
      );
      expect(result).toEqual({ netWeight: { netWeightUnitId: null } });
    });

    describe('brand handling', () => {
      it('uses brandId when brand is dirty and brandId provided', () => {
        const result = buildDirtyUpdateInput(
          baseFormData,
          { brand: true },
          null,
          'brand-1',
        );
        expect(result).toEqual({ brand: { brandId: 'brand-1' } });
      });

      it('uses brandName when brand is dirty, no brandId, but brand text exists', () => {
        const result = buildDirtyUpdateInput(
          baseFormData,
          { brand: true },
          null,
          null,
        );
        expect(result).toEqual({ brand: { brandName: 'Organic Valley' } });
      });

      it('sets brandId to null when brand is dirty with no brandId and empty brand text', () => {
        const formData = { ...baseFormData, brand: '' };
        const result = buildDirtyUpdateInput(
          formData,
          { brand: true },
          null,
          null,
        );
        expect(result).toEqual({ brand: { brandId: null } });
      });
    });

    it('includes multiple dirty fields', () => {
      const result = buildDirtyUpdateInput(
        baseFormData,
        { itemName: true, notes: true, tags: true },
        null,
        null,
      );

      expect(result).toEqual({
        itemName: 'Milk',
        storage: { storageNotes: 'Whole milk' },
        tags: ['organic'],
      });
    });
  });
});
