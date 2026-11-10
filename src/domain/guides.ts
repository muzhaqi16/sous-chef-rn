/** The first things worth doing, each with a short guide. */
export type GuideItem = 'stock' | 'shop' | 'cook' | 'plan';

/**
 * Each guide's tour id: the Getting started card starts it, and the screen it
 * runs on hosts it under this id.
 */
export const GUIDE_TOURS: Record<GuideItem, string> = {
  stock: 'stock_pantry',
  shop: 'first_shop',
  cook: 'cook_from_pantry',
  plan: 'plan_meal',
};
