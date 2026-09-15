import { Cuisine } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';
import {
  POPULAR_CUISINES,
  cuisineLabelKey,
  getAllCuisineOptions,
} from '#features/profile/constants/cuisines';

describe('cuisines constants', () => {
  describe('POPULAR_CUISINES', () => {
    it('exports an array of 8 popular cuisines', () => {
      expect(POPULAR_CUISINES).toHaveLength(8);
    });

    it('each cuisine has a label key and a value', () => {
      for (const cuisine of POPULAR_CUISINES) {
        expect(typeof cuisine.labelKey).toBe('string');
        expect(cuisine.value).toBeDefined();
      }
    });

    it('keys its label off the enum value, not a hardcoded string', () => {
      const italian = POPULAR_CUISINES.find(c => c.value === Cuisine.Italian);
      expect(italian).toBeDefined();
      expect(italian!.labelKey).toBe(cuisineLabelKey(Cuisine.Italian));
    });
  });

  describe('getAllCuisineOptions', () => {
    it('returns all cuisines (popular + remaining)', () => {
      const all = getAllCuisineOptions();
      const totalCuisines = Object.values(Cuisine).length;
      expect(all).toHaveLength(totalCuisines);
    });

    it('popular cuisines come first', () => {
      const all = getAllCuisineOptions();
      for (let i = 0; i < POPULAR_CUISINES.length; i++) {
        expect(all[i]!.value).toBe(POPULAR_CUISINES[i]!.value);
      }
    });

    it('gives remaining cuisines the same key shape as popular ones', () => {
      const all = getAllCuisineOptions();
      const eastEuropean = all.find(c => c.value === Cuisine.EasternEuropean);
      expect(eastEuropean).toBeDefined();
      expect(eastEuropean!.labelKey).toBe(
        cuisineLabelKey(Cuisine.EasternEuropean),
      );
      expect(t(eastEuropean!.labelKey)).toBe('Eastern European');
    });

    it('each option has a label key and value', () => {
      const all = getAllCuisineOptions();
      for (const option of all) {
        expect(typeof option.labelKey).toBe('string');
        expect(option.value).toBeDefined();
      }
    });
  });
});
