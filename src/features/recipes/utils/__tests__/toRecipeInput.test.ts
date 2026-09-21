import { toRecipeInput } from '#features/recipes/utils/toRecipeInput';
import type { RecipeInformation } from '#/services/spoonacular/types';

/**
 * The Spoonacular payload is cast, never validated. A save that throws while
 * building its input leaves the favourite control saving forever, so a missing
 * summary, cuisine list or step list is read as empty.
 */
describe('building an import from a Spoonacular payload missing fields', () => {
  const payload = {
    id: 7,
    title: 'Plain toast',
    servings: 1,
    summary: null,
    cuisines: null,
    analyzedInstructions: [{ name: '', steps: null }],
  } as unknown as RecipeInformation;

  it('does not throw', () => {
    expect(() => toRecipeInput(payload)).not.toThrow();
  });

  it('reads the missing fields as empty', () => {
    const input = toRecipeInput(payload);

    expect(input.description).toBeUndefined();
    expect(input.metadata.cuisine).toBeUndefined();
    expect(input.instructions).toEqual([]);
  });
});
