'use no memo';
import type { ReactNode } from 'react';
import { HomeTabs } from '../HomeTabs';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: 'Navigator',
    Screen: 'Screen',
    Group: 'Group',
  }),
  createBottomTabScreen: <T,>(config: T): T => config,
}));
jest.mock('../PantryStack', () => ({ PantryStack: 'PantryStack' }));
jest.mock('../ShoppingListStack', () => ({
  ShoppingListStack: 'ShoppingListStack',
}));
jest.mock('../RecipeStack', () => ({ RecipeStack: 'RecipeStack' }));
jest.mock('../MealPlanStack', () => ({ MealPlanStack: 'MealPlanStack' }));
jest.mock('#/context/TabBarActionsContext', () => ({
  TabBarActionsProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('#components/navigation/FloatingTabBar/FloatingTabBar', () => ({
  FloatingTabBar: 'FloatingTabBar',
}));

describe('HomeTabs', () => {
  it('is defined', () => {
    expect(HomeTabs).toBeDefined();
  });

  it('exports a valid component', () => {
    expect(HomeTabs).toBeDefined();
  });
});
