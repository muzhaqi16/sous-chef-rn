import { MealType } from '#/graphql/generated/schemaTypes';
import { MEAL_TYPE_ORDER } from '../mealPlanEnumLabels';

describe('MEAL_TYPE_ORDER', () => {
  it('lists every meal type in the order of the day', () => {
    expect(MEAL_TYPE_ORDER).toEqual([
      MealType.Breakfast,
      MealType.Brunch,
      MealType.Lunch,
      MealType.Snack,
      MealType.Dinner,
      MealType.Dessert,
    ]);
  });
});
