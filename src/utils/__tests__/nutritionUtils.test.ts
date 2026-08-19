import {
  parseNutritions,
  hasNutritionData,
  getScaleFactor,
  formatServingSize,
  extractMacroSummary,
  generateHighlights,
  formatNutritionValue,
  formatCalories,
  getNutrientEntries,
  groupNutrientsByCategory,
  getCategoryLabel,
} from '../nutritionUtils';
import type { NutrientCategory, NutritionsData } from '#/types/nutrition';

const mockNutritions: NutritionsData = {
  servingSize: '100g',
  servingSizeGrams: 100,
  calories: { amount: 200, unit: 'kcal', name: 'Calories' },
  protein: { amount: 15, unit: 'g', name: 'Protein' },
  totalFat: { amount: 8, unit: 'g', name: 'Total Fat' },
  carbohydrates: { amount: 25, unit: 'g', name: 'Carbohydrates' },
  fiber: { amount: 4, unit: 'g', name: 'Fiber' },
  sugar: { amount: 3, unit: 'g', name: 'Sugar' },
  sodium: { amount: 700, unit: 'mg', name: 'Sodium' },
  vitaminC: { amount: 10, unit: 'mg', name: 'Vitamin C' },
  iron: { amount: 2, unit: 'mg', name: 'Iron' },
  calcium: { amount: 150, unit: 'mg', name: 'Calcium' },
  potassium: { amount: 500, unit: 'mg', name: 'Potassium' },
};

describe('parseNutritions', () => {
  it('returns null for null input', () => {
    expect(parseNutritions(null)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(parseNutritions('string')).toBeNull();
    expect(parseNutritions(123)).toBeNull();
  });

  it('returns the object for valid input', () => {
    expect(parseNutritions(mockNutritions)).toBe(mockNutritions);
  });
});

describe('hasNutritionData', () => {
  it('returns false for null', () => {
    expect(hasNutritionData(null)).toBe(false);
  });

  it('returns true when protein has amount', () => {
    expect(hasNutritionData(mockNutritions)).toBe(true);
  });

  it('returns false when no nutrient keys have amounts', () => {
    expect(hasNutritionData({ servingSize: '100g' })).toBe(false);
  });
});

describe('getScaleFactor', () => {
  it('returns 1 when no actual serving grams', () => {
    expect(getScaleFactor(mockNutritions)).toBe(1);
    expect(getScaleFactor(mockNutritions, null)).toBe(1);
  });

  it('returns 1 when no servingSizeGrams', () => {
    expect(getScaleFactor({}, 200)).toBe(1);
  });

  it('scales correctly', () => {
    expect(getScaleFactor(mockNutritions, 200)).toBe(2);
    expect(getScaleFactor(mockNutritions, 50)).toBe(0.5);
  });
});

describe('formatServingSize', () => {
  it('formats grams', () => {
    expect(formatServingSize(250)).toBe('250g');
  });

  it('formats kilograms at >= 1000', () => {
    expect(formatServingSize(1500)).toBe('1.5kg');
    expect(formatServingSize(1000)).toBe('1.0kg');
  });

  it('rounds grams to nearest integer', () => {
    expect(formatServingSize(33.7)).toBe('34g');
  });
});

describe('extractMacroSummary', () => {
  it('returns all nulls for null nutritions', () => {
    const result = extractMacroSummary(null);
    expect(result.calories).toBeNull();
    expect(result.protein).toBeNull();
    expect(result.carbs).toBeNull();
    expect(result.fat).toBeNull();
    expect(result.servingSize).toBeNull();
  });

  it('extracts macros without scaling', () => {
    const result = extractMacroSummary(mockNutritions);
    expect(result.calories).toBe(200);
    expect(result.protein).toBe(15);
    expect(result.carbs).toBe(25);
    expect(result.fat).toBe(8);
    expect(result.servingSize).toBe('100g');
  });

  it('scales macros based on actual serving', () => {
    const result = extractMacroSummary(mockNutritions, 200);
    expect(result.calories).toBe(400);
    expect(result.protein).toBe(30);
    expect(result.servingSize).toBe('200g');
  });
});

describe('generateHighlights', () => {
  it('returns empty array for null', () => {
    expect(generateHighlights(null)).toEqual([]);
  });

  it('detects High Protein (>= 10g)', () => {
    const highlights = generateHighlights(mockNutritions);
    expect(highlights).toContainEqual({
      labelKey: 'nutritionHighlights.highProtein',
      type: 'positive',
    });
  });

  it('detects Good Fiber (>= 3g)', () => {
    const highlights = generateHighlights(mockNutritions);
    expect(highlights).toContainEqual({
      labelKey: 'nutritionHighlights.goodFiber',
      type: 'positive',
    });
  });

  it('detects Low Sugar (<= 5g)', () => {
    const highlights = generateHighlights(mockNutritions);
    expect(highlights).toContainEqual({
      labelKey: 'nutritionHighlights.lowSugar',
      type: 'positive',
    });
  });

  it('detects High Sodium (>= 600mg) as caution', () => {
    const highlights = generateHighlights(mockNutritions);
    expect(highlights).toContainEqual({
      labelKey: 'nutritionHighlights.highSodium',
      type: 'caution',
    });
  });

  it('detects Vitamin C (>= 9mg)', () => {
    const highlights = generateHighlights(mockNutritions);
    expect(highlights).toContainEqual({
      labelKey: 'nutritionHighlights.vitaminC',
      type: 'positive',
    });
  });

  it('detects Iron (>= 1.8mg)', () => {
    const highlights = generateHighlights(mockNutritions);
    expect(highlights).toContainEqual({
      labelKey: 'nutritionHighlights.iron',
      type: 'positive',
    });
  });

  it('detects Calcium (>= 130mg)', () => {
    const highlights = generateHighlights(mockNutritions);
    expect(highlights).toContainEqual({
      labelKey: 'nutritionHighlights.calcium',
      type: 'positive',
    });
  });

  it('detects Potassium (>= 470mg)', () => {
    const highlights = generateHighlights(mockNutritions);
    expect(highlights).toContainEqual({
      labelKey: 'nutritionHighlights.potassium',
      type: 'positive',
    });
  });

  it('does not detect Low Fat when fat is > 3g', () => {
    const highlights = generateHighlights(mockNutritions);
    expect(highlights).not.toContainEqual(
      expect.objectContaining({ labelKey: 'nutritionHighlights.lowFat' }),
    );
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
    expect(getNutrientEntries(null)).toEqual([]);
  });

  it('returns entries sorted by category (macro first)', () => {
    const entries = getNutrientEntries(mockNutritions);
    expect(entries.length).toBeGreaterThan(0);

    // First entry should be a macro
    expect(entries[0].category).toBe('macro');

    // Macros should come before vitamins/minerals
    const firstVitaminIdx = entries.findIndex(e => e.category === 'vitamin');
    const lastMacroIdx =
      entries.length -
      1 -
      [...entries].reverse().findIndex(e => e.category === 'macro');
    if (firstVitaminIdx !== -1) {
      expect(lastMacroIdx).toBeLessThan(firstVitaminIdx);
    }
  });

  it('scales entries with actual serving grams', () => {
    const entries = getNutrientEntries(mockNutritions, 200);
    const protein = entries.find(e => e.key === 'protein');
    expect(protein?.amount).toBe(30); // 15 * 2
  });

  it('skips servingSize and servingSizeGrams keys', () => {
    const entries = getNutrientEntries(mockNutritions);
    expect(entries.find(e => e.key === 'servingSize')).toBeUndefined();
    expect(entries.find(e => e.key === 'servingSizeGrams')).toBeUndefined();
  });
});

describe('groupNutrientsByCategory', () => {
  it('groups entries correctly', () => {
    const entries = getNutrientEntries(mockNutritions);
    const grouped = groupNutrientsByCategory(entries);
    expect(grouped.macro?.length).toBeGreaterThan(0);
    expect(grouped.mineral?.length).toBeGreaterThan(0);
  });
});

describe('getCategoryLabel', () => {
  it.each<[NutrientCategory, string]>([
    ['macro', 'Macronutrients'],
    ['vitamin', 'Vitamins'],
    ['mineral', 'Minerals'],
    ['other', 'Other'],
  ])('returns %s for %s', (cat, label) => {
    expect(getCategoryLabel(cat)).toBe(label);
  });
});
