'use no memo';
import { HomeTabs } from '../HomeTabs';

jest.mock('#/apollo/links/tokenScheduler', () => ({ scheduleTokenRefresh: jest.fn(), cancelScheduledRefresh: jest.fn() }));
jest.mock('#/apollo/links/refreshToken', () => ({ refreshAccessToken: jest.fn() }));
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: 'Navigator',
    Screen: 'Screen',
    Group: 'Group',
  }),
}));
jest.mock('../PantryStack', () => ({ PantryStack: 'PantryStack' }));
jest.mock('../ShoppingListStack', () => ({ ShoppingListStack: 'ShoppingListStack' }));
jest.mock('../RecipeStack', () => ({ RecipeStack: 'RecipeStack' }));
jest.mock('../MealPlanStack', () => ({ MealPlanStack: 'MealPlanStack' }));
jest.mock('#/context/TabBarActionsContext', () => ({
  TabBarActionsProvider: ({ children }: any) => children,
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
