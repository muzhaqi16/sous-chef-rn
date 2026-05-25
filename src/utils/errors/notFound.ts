const RESOURCE_DISPLAY_NAMES: Record<string, string> = {
  PantryItem: 'pantry item',
  Pantry: 'pantry',
  ShoppingList: 'shopping list',
  ShoppingListItem: 'shopping item',
  Recipe: 'recipe',
  RecipeReview: 'review',
  Home: 'home',
  MealPlan: 'meal plan',
  MealPlanItem: 'meal plan item',
  MealTemplate: 'meal template',
  StorageLocation: 'storage location',
  User: 'user',
  Item: 'item',
  Notification: 'notification',
};

export function isNotFoundErrorPayload(payload: {
  __typename: string;
}): boolean {
  return payload.__typename === 'NotFoundError';
}

export function getNotFoundMessage(resource?: string | null): string {
  if (!resource) {
    return 'The requested item could not be found. It may have been deleted.';
  }

  const displayName =
    RESOURCE_DISPLAY_NAMES[resource] || resource.toLowerCase();
  return `The ${displayName} could not be found. It may have been deleted or moved.`;
}
