import { toRecipeInput } from '#features/recipes/utils/toRecipeInput';
import type { RecipeInformation } from '#/services/spoonacular/types';

/**
 * The server resolves an imported ingredient's unit from `usUnit ?? metricUnit`
 * and reads nothing else. An import that sends only the typed mirror is stored
 * with no unit at all, and every path that needs one then skips the ingredient.
 */

const recipe = {
  id: 1,
  title: 'Inside-Out Lasagna',
  servings: 4,
  extendedIngredients: [
    {
      id: 20420,
      name: 'rotini',
      original: '8 ounces whole-wheat rotini',
      amount: 8,
      unit: 'ounces',
      measures: {
        us: { amount: 8, unitShort: 'oz', unitLong: 'ounces' },
        metric: { amount: 226.796, unitShort: 'g', unitLong: 'grams' },
      },
    },
    {
      id: 11282,
      name: 'onion',
      original: '1 onion',
      amount: 1,
      unit: '',
      measures: {
        us: { amount: 1, unitShort: '', unitLong: '' },
        metric: { amount: 1, unitShort: '', unitLong: '' },
      },
    },
  ],
} as unknown as RecipeInformation;

describe('sending an imported recipe’s units', () => {
  const ingredients = toRecipeInput(recipe).ingredients ?? [];

  it('sends the flat pair the server actually reads', () => {
    expect(ingredients[0]).toMatchObject({
      usAmount: 8,
      usUnit: 'oz',
      metricAmount: 226.796,
      metricUnit: 'g',
    });
  });

  it('sends both systems nested as well', () => {
    expect(ingredients[0]?.measurements).toEqual({
      usAmount: 8,
      usUnit: 'oz',
      metricAmount: 226.796,
      metricUnit: 'g',
    });
  });

  it('keeps the loss-free mirror alongside them', () => {
    const mirror = ingredients[0]?.externalSources?.[0]?.spoonacular;

    expect(mirror?.measures?.metric?.unitShort).toBe('g');
    expect(mirror?.unit).toBe('ounces');
  });

  it('falls back to the bare unit string when no US measure is stated', () => {
    const noMeasures = {
      ...recipe,
      extendedIngredients: [
        { id: 1, name: 'salt', amount: 1, unit: 'pinch', measures: undefined },
      ],
    } as unknown as RecipeInformation;

    expect(toRecipeInput(noMeasures).ingredients?.[0]?.usUnit).toBe('pinch');
  });

  it('leaves a bare count with an empty unit rather than inventing one', () => {
    // "1 onion" has no unit on either side; the server stores no unit and every
    // consumer skips it, which is correct.
    expect(ingredients[1]).toMatchObject({ usUnit: '', metricUnit: '' });
  });
});
