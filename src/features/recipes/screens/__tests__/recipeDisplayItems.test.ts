import { t } from '#/i18n';
import { toDisplayItems } from '../recipeDisplayItems';
import type { RecipeRow } from '#features/recipes/utils/recipeRows';

const suggestion = (
  coverage: number,
  missingIngredientCount: number,
  used: string[],
): RecipeRow => ({
  source: 'suggestion',
  edge: {
    __typename: 'RecipeSuggestionEdge',
    coverage,
    missingIngredientCount,
    usedIngredients: used.map(name => ({
      __typename: 'RecipeIngredient',
      id: `ing-${name}`,
      name,
      item: null,
    })),
    missingIngredients: [],
    expiringStacks: [],
    node: {
      __typename: 'Recipe',
      version: 1,
      id: 'r1',
      name: 'Frittata',
      imageUrl: null,
      servings: 2,
      totalTimeMinutes: null,
    },
  },
});

const card = (row: RecipeRow) => toDisplayItems([row], t)[0];

describe('a suggestion card for a new pantry', () => {
  it('says what it uses and how much is left to buy, with no percentage', () => {
    const item = card(suggestion(18, 3, ['eggs']));

    expect(item?.subtitle).toContain(
      t('recipes.usesYourMoreToBuy', { item: 'eggs', count: 3 }),
    );
    expect(item?.badge).toBeUndefined();
  });

  it('calls a recipe half held ready to cook, with the share held', () => {
    const item = card(suggestion(60, 3, ['eggs', 'cheddar']));

    expect(item?.subtitle).toContain(t('recipes.readyToCook'));
    expect(item?.badge?.text).toBe(
      t('recipes.pantryCoverage', { percent: 60 }),
    );
  });

  it('calls a recipe two short ready to cook, with no share under half', () => {
    const item = card(suggestion(33, 2, ['lemon']));

    expect(item?.subtitle).toContain(t('recipes.readyToCook'));
    expect(item?.badge).toBeUndefined();
  });

  it('names no tier for a recipe that uses nothing held', () => {
    const item = card(suggestion(0, 6, []));

    expect(item?.subtitle).not.toContain(t('recipes.readyToCook'));
    expect(item?.badge).toBeUndefined();
  });
});
