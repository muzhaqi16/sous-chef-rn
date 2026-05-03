import { Cuisine } from '#/graphql/generated/schemaTypes';
import {
  POPULAR_CUISINES,
  getCuisineLabel,
  getAllCuisineOptions,
} from '../cuisines';

describe('cuisines constants', () => {
  describe('POPULAR_CUISINES', () => {
    it('exports an array of 8 popular cuisines', () => {
      expect(POPULAR_CUISINES).toHaveLength(8);
    });

    it('each cuisine has a label and a value', () => {
      for (const cuisine of POPULAR_CUISINES) {
        expect(cuisine.label).toBeDefined();
        expect(typeof cuisine.label).toBe('string');
        expect(cuisine.value).toBeDefined();
      }
    });

    it('includes Italian as a popular cuisine', () => {
      const italian = POPULAR_CUISINES.find(c => c.value === Cuisine.Italian);
      expect(italian).toBeDefined();
      expect(italian!.label).toBe('Italian');
    });
  });

  describe('getCuisineLabel', () => {
    it('returns the label for a popular cuisine', () => {
      expect(getCuisineLabel(Cuisine.Italian)).toBe('Italian');
      expect(getCuisineLabel(Cuisine.Mexican)).toBe('Mexican');
      expect(getCuisineLabel(Cuisine.Japanese)).toBe('Japanese');
    });

    it('returns the raw value for a non-popular cuisine', () => {
      // For cuisines not in POPULAR_CUISINES, it falls back to the enum value string
      expect(getCuisineLabel(Cuisine.French)).toBe(Cuisine.French);
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
      // First 8 should be the popular ones
      for (let i = 0; i < POPULAR_CUISINES.length; i++) {
        expect(all[i].value).toBe(POPULAR_CUISINES[i].value);
      }
    });

    it('remaining cuisines have formatted labels', () => {
      const all = getAllCuisineOptions();
      // Find a non-popular cuisine
      const eastEuropean = all.find(c => c.value === Cuisine.EasternEuropean);
      expect(eastEuropean).toBeDefined();
      // EASTERN_EUROPEAN -> "Eastern European"
      expect(eastEuropean!.label).toBe('Eastern European');
    });

    it('each option has a label and value', () => {
      const all = getAllCuisineOptions();
      for (const option of all) {
        expect(option.label).toBeDefined();
        expect(typeof option.label).toBe('string');
        expect(option.value).toBeDefined();
      }
    });
  });
});
