import { buildDirtyUpdateInput } from '../utils';
import type { FormDataInput } from '../types';
import type { StorageState } from '#/graphql/generated/schemaTypes';

describe('pantry mutations utils', () => {
  describe('buildDirtyUpdateInput', () => {
    const baseFormData: FormDataInput = {
      itemName: 'Milk',
      storageState: 'PANTRY' as StorageState,
      location: 'Fridge',
      expirationDate: new Date(2026, 5, 1),
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

    it('includes expiresOn as a local date key when dirty', () => {
      const result = buildDirtyUpdateInput(
        baseFormData,
        { expirationDate: true },
        null,
        null,
      );
      expect(result).toEqual({ expiresOn: '2026-06-01' });
    });

    it('includes null expiresOn when date is undefined', () => {
      const formData = { ...baseFormData, expirationDate: undefined };
      const result = buildDirtyUpdateInput(
        formData,
        { expirationDate: true },
        null,
        null,
      );
      expect(result).toEqual({ expiresOn: null });
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

    it('pairs a dirty netWeightUnitId with the effective weight value', () => {
      // API rule on update: a unit without a value is rejected. Changing only
      // the unit must still send the current weight value alongside it.
      const result = buildDirtyUpdateInput(
        baseFormData,
        { netWeightUnitId: true },
        null,
        null,
      );
      expect(result).toEqual({
        netWeight: { netWeight: 1.5, netWeightUnitId: 'nw-unit-1' },
      });
    });

    it('drops a dirty netWeightUnitId when there is no weight value to pair', () => {
      const formData = { ...baseFormData, netWeight: '' };
      const result = buildDirtyUpdateInput(
        formData,
        { netWeightUnitId: true },
        null,
        null,
      );
      // Nothing to attach the unit to — sending it alone would be rejected.
      expect(result).toEqual({});
    });

    it('drops the unit but keeps the cleared value when both are dirty and value is blank', () => {
      const formData = { ...baseFormData, netWeight: '' };
      const result = buildDirtyUpdateInput(
        formData,
        { netWeight: true, netWeightUnitId: true },
        null,
        null,
      );
      expect(result).toEqual({ netWeight: { netWeight: null } });
    });

    it('sets netWeightUnitId to null when empty', () => {
      // Clearing the unit alone is allowed (value-without-unit is valid).
      const formData = { ...baseFormData, netWeightUnitId: '' };
      const result = buildDirtyUpdateInput(
        formData,
        { netWeightUnitId: true },
        null,
        null,
      );
      expect(result).toEqual({ netWeight: { netWeightUnitId: null } });
    });

    // `unit` only relabels the unit in use; the unit changes through
    // `changePantryItemUnit`, so a dirty unit field sends nothing here.
    it('never sends a unit', () => {
      expect(
        buildDirtyUpdateInput(baseFormData, { unit: true }, null, null),
      ).toEqual({});
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
