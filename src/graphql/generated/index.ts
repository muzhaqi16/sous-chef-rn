// This file is auto-generated. Do not edit manually.
// Barrel re-export of all per-operation generated files + base types.
// When removing a feature, delete its re-export line here and its .generated.ts files.
/* eslint-disable */
// @ts-nocheck

// Base schema types (enums, input types, object types, scalars)
export * from './baseTypes';

// --- Feature operations ---

// Pantry
export * from '../../features/pantry/graphql/pantry.generated';

// Recipes
export * from '../../features/recipes/graphql/recipe.generated';
export * from '../../features/recipes/graphql/recipeReview.generated';

// Shopping List
export * from '../../features/shoppingList/graphql/shoppingList.generated';
export * from '../../features/shoppingList/graphql/collaboration.generated';

// Meal Plan
export * from '../../features/mealPlan/graphql/mealPlan.generated';
export * from '../../features/mealPlan/graphql/mealTemplate.generated';

// Notifications
export * from '../../features/notifications/graphql/notifications.generated';
export * from '../../features/notifications/graphql/notificationMutations.generated';
export * from '../../features/notifications/graphql/bulkNotificationMutations.generated';
export * from '../../features/notifications/graphql/expirationNotificationMutations.generated';
export * from '../../features/notifications/graphql/notificationStats.generated';

// --- Core operations ---

// Auth
export * from '../operations/auth/auth.generated';
export * from '../operations/auth/device.generated';
export * from '../operations/auth/user.generated';

// Home
export * from '../operations/home/home.generated';
export * from '../operations/home/membership.generated';
export * from '../operations/home/userSettings.generated';

// Items
export * from '../operations/item/item.generated';
export * from '../operations/item/unit.generated';
export * from '../operations/item/conversions.generated';

// Shared
export * from '../operations/fragments.generated';
export * from '../operations/image/imageUpload.generated';
export * from '../operations/storageLocation/storageLocation.generated';
export * from '../operations/store/store.generated';
export * from '../operations/user/user.generated';
