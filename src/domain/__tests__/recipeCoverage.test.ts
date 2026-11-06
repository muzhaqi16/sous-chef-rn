import { suggestionTier } from '../recipeCoverage';

const tier = (
  coverage: number,
  missingIngredientCount: number,
  usedIngredientCount: number,
) => suggestionTier({ coverage, missingIngredientCount, usedIngredientCount });

describe('suggestionTier', () => {
  it('is ready when the pantry holds half the recipe', () => {
    expect(tier(50, 6, 6)).toBe('ready');
  });

  it('is ready two ingredients short, however few it holds', () => {
    expect(tier(20, 2, 1)).toBe('ready');
  });

  it('is almost there when it uses something held and lacks more', () => {
    expect(tier(18, 5, 1)).toBe('almost');
  });

  it('is no pantry suggestion when it uses nothing held', () => {
    expect(tier(0, 2, 0)).toBeNull();
  });
});
