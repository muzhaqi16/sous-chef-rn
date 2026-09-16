import { getSpoonacularIngredientImageUrl } from '../utils';

describe('getSpoonacularIngredientImageUrl', () => {
  it('returns CDN URL', () => {
    expect(getSpoonacularIngredientImageUrl('pasta.png')).toBe(
      'https://spoonacular.com/cdn/ingredients_100x100/pasta.png',
    );
  });

  it('returns empty string for empty input', () => {
    expect(getSpoonacularIngredientImageUrl('')).toBe('');
  });
});
