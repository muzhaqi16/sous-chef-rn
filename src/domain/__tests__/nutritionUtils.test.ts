import {
  hasNutritionData,
  formatServing,
  extractMacroSummary,
  generateHighlights,
  formatNutritionValue,
  formatCalories,
  getNutrientEntries,
  groupNutrientsByCategory,
  getCategoryLabel,
  type NutritionFactsValues,
} from '#domain/nutrition';
import type { NutrientCategory } from '#/types/nutrition';
import { getI18n } from '#/i18n/config';

// The real instance, so the assertions read the copy in en.json.
const t = getI18n().t;

const EMPTY_FACTS: NutritionFactsValues = {
  calories: null,
  totalFat: null,
  saturatedFat: null,
  transFat: null,
  cholesterol: null,
  sodium: null,
  totalCarbs: null,
  dietaryFiber: null,
  totalSugars: null,
  addedSugars: null,
  protein: null,
  vitaminD: null,
  calcium: null,
  iron: null,
  potassium: null,
  servingSize: null,
  servingUnit: null,
};

// `Item.nutritionFacts` as the API returns it: flat numbers in canonical units.
const facts: NutritionFactsValues = {
  ...EMPTY_FACTS,
  calories: 200,
  protein: 15,
  totalFat: 8,
  totalCarbs: 25,
  dietaryFiber: 4,
  totalSugars: 3,
  sodium: 700,
  vitaminD: 2.5,
  iron: 2,
  calcium: 150,
  potassium: 500,
  servingSize: 100,
  servingUnit: 'g',
};

describe('hasNutritionData', () => {
  it('returns false for null', () => {
    expect(hasNutritionData(null)).toBe(false);
  });

  it('returns true when a macro has a value', () => {
    expect(hasNutritionData(facts)).toBe(true);
  });

  it('returns true for a stored zero', () => {
    expect(hasNutritionData({ ...EMPTY_FACTS, totalFat: 0 })).toBe(true);
  });

  it('returns false when only the serving is known', () => {
    expect(
      hasNutritionData({ ...EMPTY_FACTS, servingSize: 30, servingUnit: 'g' }),
    ).toBe(false);
  });
});

describe('formatServing', () => {
  it('states the serving in its unit', () => {
    expect(formatServing(facts)).toBe('100 g');
  });

  it('writes a fractional serving as a cooking fraction', () => {
    expect(formatServing({ servingSize: 0.5, servingUnit: 'cup' })).toBe(
      '1/2 cup',
    );
  });

  it('returns null without a unit or a positive size', () => {
    expect(formatServing({ servingSize: 30, servingUnit: null })).toBeNull();
    expect(formatServing({ servingSize: 30, servingUnit: ' ' })).toBeNull();
    expect(formatServing({ servingSize: 0, servingUnit: 'g' })).toBeNull();
    expect(formatServing({ servingSize: null, servingUnit: 'g' })).toBeNull();
  });
});

describe('extractMacroSummary', () => {
  it('returns all nulls for null facts', () => {
    expect(extractMacroSummary(null)).toEqual({
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      servingSize: null,
    });
  });

  it('reads the flat NutritionFacts columns', () => {
    expect(extractMacroSummary(facts)).toEqual({
      calories: 200,
      protein: 15,
      carbs: 25,
      fat: 8,
      servingSize: '100 g',
    });
  });
});

describe('generateHighlights', () => {
  it('returns empty array for null', () => {
    expect(generateHighlights(null)).toEqual([]);
  });

  it.each([
    ['recipes.healthGoal.HIGH_PROTEIN', 'positive'],
    ['nutritionHighlights.goodFiber', 'positive'],
    ['nutritionHighlights.lowSugar', 'positive'],
    ['nutritionHighlights.highSodium', 'caution'],
    ['nutritionHighlights.iron', 'positive'],
    ['nutritionHighlights.calcium', 'positive'],
    ['nutritionHighlights.potassium', 'positive'],
  ])('detects %s', (labelKey, type) => {
    expect(generateHighlights(facts)).toContainEqual({ labelKey, type });
  });

  it('does not detect Low Fat when fat is > 3g', () => {
    expect(generateHighlights(facts)).not.toContainEqual(
      expect.objectContaining({ labelKey: 'nutritionHighlights.lowFat' }),
    );
  });

  it('meets no threshold with an absent value, a `<=` one included', () => {
    expect(generateHighlights(EMPTY_FACTS)).toEqual([]);
  });
});

describe('formatNutritionValue', () => {
  it('returns "-" for null', () => {
    expect(formatNutritionValue(null, 'g')).toBe('-');
  });

  it('returns "-" for undefined', () => {
    expect(formatNutritionValue(undefined, 'g')).toBe('-');
  });

  it('formats whole numbers without decimal', () => {
    expect(formatNutritionValue(5, 'g')).toBe('5g');
  });

  it('formats decimals to 1 place', () => {
    expect(formatNutritionValue(5.4, 'g')).toBe('5.4g');
  });

  it('rounds to 1 decimal', () => {
    expect(formatNutritionValue(5.46, 'mg')).toBe('5.5mg');
  });
});

describe('formatCalories', () => {
  it('returns "-" for null', () => {
    expect(formatCalories(null)).toBe('-');
  });

  it('rounds to integer', () => {
    expect(formatCalories(199.6)).toBe('200');
    expect(formatCalories(150)).toBe('150');
  });
});

describe('getNutrientEntries', () => {
  it('returns empty array for null', () => {
    expect(getNutrientEntries(null, t)).toEqual([]);
  });

  it('lists each stored column with its canonical unit and label', () => {
    const entries = getNutrientEntries(facts, t);
    expect(entries.find(e => e.key === 'totalCarbs')).toEqual({
      key: 'totalCarbs',
      name: 'Carbohydrates',
      amount: 25,
      unit: 'g',
      category: 'macro',
    });
    expect(entries.find(e => e.key === 'sodium')).toMatchObject({
      amount: 700,
      unit: 'mg',
      category: 'mineral',
    });
    expect(entries.find(e => e.key === 'vitaminD')).toMatchObject({
      amount: 2.5,
      unit: 'mcg',
      category: 'vitamin',
    });
  });

  it('skips null columns and the serving', () => {
    const keys = getNutrientEntries(facts, t).map(e => e.key);
    expect(keys).not.toContain('saturatedFat');
    expect(keys).not.toContain('servingSize');
    expect(keys).not.toContain('servingUnit');
  });

  it('sorts macros, then vitamins, then minerals', () => {
    const categories = getNutrientEntries(facts, t).map(e => e.category);
    expect(categories).toEqual([
      ...categories.filter(c => c === 'macro'),
      ...categories.filter(c => c === 'vitamin'),
      ...categories.filter(c => c === 'mineral'),
    ]);
  });
});

describe('groupNutrientsByCategory', () => {
  it('groups entries correctly', () => {
    const grouped = groupNutrientsByCategory(getNutrientEntries(facts, t));
    expect(grouped.macro?.length).toBeGreaterThan(0);
    expect(grouped.vitamin?.map(e => e.key)).toEqual(['vitaminD']);
    expect(grouped.mineral?.length).toBe(4);
  });
});

describe('getCategoryLabel', () => {
  it.each<[NutrientCategory, string]>([
    ['macro', 'Macronutrients'],
    ['vitamin', 'Vitamins'],
    ['mineral', 'Minerals'],
  ])('returns %s for %s', (cat, label) => {
    expect(getCategoryLabel(cat, t)).toBe(label);
  });
});
