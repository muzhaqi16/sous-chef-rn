// ── Filter options — synced with DietaryRestrictionSelector + Spoonacular API values ──
// `value` is the Spoonacular API value (do not translate). `labelKey` resolves
// to the translated chip label via i18n. Shared by RecipeFilterSheet (selection
// UI) and ActiveFilterChipsRow (active-filter display).

export interface RecipeFilterOption {
  labelKey: string;
  value: string;
}

export const DIET_OPTIONS: RecipeFilterOption[] = [
  { labelKey: 'recipeFilters.diets.vegetarian', value: 'vegetarian' },
  { labelKey: 'recipeFilters.diets.vegan', value: 'vegan' },
  { labelKey: 'recipeFilters.diets.glutenFree', value: 'gluten free' },
  { labelKey: 'recipeFilters.diets.ketogenic', value: 'ketogenic' },
  { labelKey: 'recipeFilters.diets.paleo', value: 'paleo' },
  { labelKey: 'recipeFilters.diets.pescetarian', value: 'pescetarian' },
  {
    labelKey: 'recipeFilters.diets.lactoVegetarian',
    value: 'lacto-vegetarian',
  },
  { labelKey: 'recipeFilters.diets.ovoVegetarian', value: 'ovo-vegetarian' },
  { labelKey: 'recipeFilters.diets.primal', value: 'primal' },
  { labelKey: 'recipeFilters.diets.lowFodmap', value: 'low fodmap' },
  { labelKey: 'recipeFilters.diets.whole30', value: 'whole30' },
];

export const INTOLERANCE_OPTIONS: RecipeFilterOption[] = [
  { labelKey: 'recipeFilters.intolerances.dairy', value: 'dairy' },
  { labelKey: 'recipeFilters.intolerances.egg', value: 'egg' },
  { labelKey: 'recipeFilters.intolerances.gluten', value: 'gluten' },
  { labelKey: 'recipeFilters.intolerances.grain', value: 'grain' },
  { labelKey: 'recipeFilters.intolerances.peanut', value: 'peanut' },
  { labelKey: 'recipeFilters.intolerances.seafood', value: 'seafood' },
  { labelKey: 'recipeFilters.intolerances.sesame', value: 'sesame' },
  { labelKey: 'recipeFilters.intolerances.shellfish', value: 'shellfish' },
  { labelKey: 'recipeFilters.intolerances.soy', value: 'soy' },
  { labelKey: 'recipeFilters.intolerances.sulfite', value: 'sulfite' },
  { labelKey: 'recipeFilters.intolerances.treeNut', value: 'tree nut' },
  { labelKey: 'recipeFilters.intolerances.wheat', value: 'wheat' },
  { labelKey: 'recipeFilters.intolerances.fish', value: 'fish' },
];

export const MEAL_TYPES: RecipeFilterOption[] = [
  { labelKey: 'recipeFilters.mealTypes.breakfast', value: 'breakfast' },
  { labelKey: 'recipeFilters.mealTypes.lunch', value: 'lunch' },
  { labelKey: 'recipeFilters.mealTypes.dinner', value: 'dinner' },
  { labelKey: 'recipeFilters.mealTypes.snack', value: 'snack' },
  { labelKey: 'recipeFilters.mealTypes.dessert', value: 'dessert' },
];

/** Find the i18n label key for a filter value; falls back to the raw value. */
export function filterOptionLabelKey(
  options: RecipeFilterOption[],
  value: string,
): string {
  return options.find(option => option.value === value)?.labelKey ?? value;
}
