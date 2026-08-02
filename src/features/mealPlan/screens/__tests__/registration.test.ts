jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackScreen: <T>(config: T): T => config,
}));
jest.mock('../CreateMealPlanScreen', () => ({
  CreateMealPlanScreen: () => null,
}));
jest.mock('../MealTemplateBuilderScreen', () => ({
  MealTemplateBuilderScreen: () => null,
}));

import { expectDeclaresLinkingIntent } from '#/test-utils/screenRegistration';
import { mealPlanDetailScreens } from '../registration';

describe('mealPlanDetailScreens', () => {
  it('registers every meal plan detail screen', () => {
    expect(Object.keys(mealPlanDetailScreens).sort()).toEqual([
      'CreateMealPlan',
      'MealTemplateBuilder',
    ]);
  });

  it('every screen declares an explicit linking intent', () => {
    expectDeclaresLinkingIntent(mealPlanDetailScreens);
  });
});
