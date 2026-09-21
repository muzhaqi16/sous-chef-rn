/**
 * Get image URL for Spoonacular ingredient
 */
export const getSpoonacularIngredientImageUrl = (imageName: string): string => {
  if (!imageName) return '';
  return `https://spoonacular.com/cdn/ingredients_100x100/${imageName}`;
};
