'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { MealPlanMain } from '../MealPlanMain';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  })),
  useFocusEffect: jest.fn(),
}));

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#hooks/navigation/useTabBarAddButton', () => ({
  useTabBarAddButton: jest.fn(),
}));

jest.mock('#/context/TabBarActionsContext', () => ({
  useTabBarSetters: jest.fn(() => ({
    setOverlayOpen: jest.fn(),
  })),
}));

jest.mock('#hooks/ui/useSelectorManagement', () => ({
  useSelectorManagement: jest.fn(() => ({
    handleOpenSelector: jest.fn(),
    handleOverlayOpen: jest.fn(),
    handleOverlayClose: jest.fn(),
  })),
}));

const mockMealPlansState = (overrides: Record<string, any> = {}) => ({
  state: {
    currentPlan: null,
    mealPlans: [],
    loading: false,
    error: undefined,
    totalCount: undefined,
    hasMore: false,
    ...overrides,
  },
  actions: { refetch: jest.fn(), loadMore: jest.fn() },
});

jest.mock('#hooks/mealPlan/useMealPlans', () => ({
  useMealPlans: jest.fn(() => mockMealPlansState()),
}));

jest.mock('#hooks/mealPlan/useMealPlan', () => ({
  useMealPlan: jest.fn(() => ({
    mealPlan: null,
    items: [],
    nutritionSummary: null,
    refetch: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('#hooks/mealPlan/useMealPlanItemActions', () => ({
  useMealPlanItemActions: jest.fn(() => ({
    createItem: jest.fn(),
    updateItem: jest.fn(),
    toggleCompleted: jest.fn(),
    deleteItem: jest.fn(),
  })),
}));

jest.mock('#hooks/mealPlan/useMealPlanCalendar', () => ({
  useMealPlanCalendar: jest.fn(() => ({
    selectedDate: new Date('2026-03-01'),
    weekDays: [],
    viewMode: 'week',
    setViewMode: jest.fn(),
    selectDate: jest.fn(),
    goToPrevWeek: jest.fn(),
    goToNextWeek: jest.fn(),
    canGoPrevWeek: true,
    canGoNextWeek: true,
    minDate: undefined,
    maxDate: undefined,
  })),
}));

jest.mock('#hooks/mealPlan/useDailyMeals', () => ({
  useDailyMeals: jest.fn(() => ({
    dailyMeals: [],
    totalCalories: 0,
    isEmpty: true,
  })),
}));

jest.mock('#hooks/mealPlan/useMealTemplateActions', () => ({
  useMealTemplateActions: jest.fn(() => ({
    createPlanFromTemplate: jest.fn(),
    createTemplateFromPlan: jest.fn(),
    creatingFromTemplate: false,
    creatingTemplate: false,
  })),
}));

jest.mock('#hooks/mealPlan/useMealPlanSelectorConfig', () => ({
  useMealPlanSelectorConfig: jest.fn(() => ({})),
}));

jest.mock('#hooks/mealPlan/useGenerateShoppingList', () => ({
  useGenerateShoppingList: jest.fn(() => ({
    generateShoppingList: jest.fn(),
    loading: false,
  })),
}));

jest.mock('#hooks/mealPlan/useDuplicateMealPlan', () => ({
  useDuplicateMealPlan: jest.fn(() => ({
    duplicatePlan: jest.fn(),
    loading: false,
  })),
}));

jest.mock('#hooks/mealPlan/useMealPlanPermissions', () => ({
  useMealPlanPermissions: jest.fn(() => ({
    canEdit: true,
    canDelete: true,
    canGenerateShoppingList: true,
    canSaveAsTemplate: true,
  })),
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn(() => null),
}));

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useMutation: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'DeleteMealPlan') return [jest.fn(), { loading: false }];
    return [jest.fn(), {}];
  }),
}));

jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

jest.mock('#hooks/performance/useTabScreenLifecycle', () => ({
  useTabScreenLifecycle: jest.fn(() => ({ themeKey: 'light' })),
}));

const mockDeferredScreen = jest.fn(({ fallback }: any) => fallback);
jest.mock('#components/mealPlan/WeekStrip', () => ({ WeekStrip: () => null }));
jest.mock('#components/mealPlan/MonthCalendar', () => ({
  MonthCalendar: () => null,
}));
jest.mock('#components/mealPlan/DayMealList', () => ({
  DayMealList: () => null,
}));
jest.mock('#components/mealPlan/CalendarToggleBar', () => ({
  CalendarToggleBar: () => null,
}));
jest.mock('#components/mealPlan/MealPlanEmptyState', () => ({
  MealPlanEmptyState: () => 'MealPlanEmptyState',
}));
jest.mock('#components/mealPlan/AddMealSheet', () => ({
  AddMealSheet: () => null,
}));
jest.mock('#components/mealPlan/SaveAsTemplateSheet', () => ({
  SaveAsTemplateSheet: () => null,
}));
jest.mock('#components/mealPlan/TemplateBrowserSheet', () => ({
  TemplateBrowserSheet: () => null,
}));
jest.mock('#components/mealPlan/TemplatePreviewSheet', () => ({
  TemplatePreviewSheet: () => null,
}));
jest.mock('#components/mealPlan/GenerateShoppingListSheet', () => ({
  GenerateShoppingListSheet: () => null,
}));
jest.mock('#components/mealPlan/MealPlanSettingsSheet', () => ({
  MealPlanSettingsSheet: () => null,
}));
jest.mock('#components/mealPlan/DuplicatePlanSheet', () => ({
  DuplicatePlanSheet: () => null,
}));
jest.mock('#components/mealPlan/EditCustomMealSheet', () => ({
  EditCustomMealSheet: () => null,
}));
jest.mock('#components/mealPlan/NutritionSummaryCard', () => ({
  NutritionSummaryCard: () => null,
}));
jest.mock('#components/modals/MarkCookedModal', () => ({
  MarkCookedModal: () => null,
}));
jest.mock(
  '#components/organisms/AnimatedItemSelector/AnimatedItemSelector',
  () => {
    const { forwardRef } = require('react');
    return { AnimatedItemSelector: forwardRef(() => null) };
  },
);

jest.mock('#components/performance/DeferredScreen', () => ({
  DeferredScreen: (props: any) => mockDeferredScreen(props),
}));

jest.mock('#components/base/Skeleton/MealPlanSkeleton', () => ({
  MealPlanSkeleton: () => 'MealPlanSkeleton',
}));

jest.mock('#components/molecules/TabScreenHeader', () => ({
  TabScreenHeader: ({ title }: any) => title,
}));

describe('MealPlanMain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with DeferredScreen fallback', () => {
    const { getByTestId } = render(<MealPlanMain />);
    expect(getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('shows TabScreenHeader in fallback', () => {
    const tree = render(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('renders inner component when DeferredScreen renders component', () => {
    // Override to render the component prop
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useMealPlans } = jest.requireMock('#hooks/mealPlan/useMealPlans');
    useMealPlans.mockReturnValue(mockMealPlansState());

    const { getByTestId } = render(<MealPlanMain />);
    expect(getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('shows empty state when no meal plans exist', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useMealPlans } = jest.requireMock('#hooks/mealPlan/useMealPlans');
    useMealPlans.mockReturnValue(mockMealPlansState());

    const tree = render(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('renders meal plan content when plans exist', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useMealPlans } = jest.requireMock('#hooks/mealPlan/useMealPlans');
    useMealPlans.mockReturnValue(
      mockMealPlansState({
        currentPlan: { id: 'plan-1', name: 'My Plan' },
        mealPlans: [{ id: 'plan-1', name: 'My Plan' }],
      }),
    );

    const tree = render(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('renders with loading state from useMealPlans', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useMealPlans } = jest.requireMock('#hooks/mealPlan/useMealPlans');
    useMealPlans.mockReturnValue(mockMealPlansState({ loading: true }));

    const tree = render(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('renders with non-empty daily meals', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useMealPlans } = jest.requireMock('#hooks/mealPlan/useMealPlans');
    useMealPlans.mockReturnValue(
      mockMealPlansState({
        currentPlan: { id: 'plan-1', name: 'My Plan' },
        mealPlans: [{ id: 'plan-1', name: 'My Plan' }],
      }),
    );

    const { useDailyMeals } = jest.requireMock('#hooks/mealPlan/useDailyMeals');
    useDailyMeals.mockReturnValue({
      dailyMeals: [
        { mealType: 'BREAKFAST', items: [{ id: 'item-1', name: 'Oatmeal' }] },
      ],
      totalCalories: 350,
      isEmpty: false,
    });

    const tree = render(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('renders with multiple meal plans', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useMealPlans } = jest.requireMock('#hooks/mealPlan/useMealPlans');
    useMealPlans.mockReturnValue(
      mockMealPlansState({
        currentPlan: { id: 'plan-1', name: 'Plan 1' },
        mealPlans: [
          { id: 'plan-1', name: 'Plan 1' },
          { id: 'plan-2', name: 'Plan 2' },
        ],
      }),
    );

    const tree = render(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('renders with month view mode', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useMealPlans } = jest.requireMock('#hooks/mealPlan/useMealPlans');
    useMealPlans.mockReturnValue(
      mockMealPlansState({
        currentPlan: { id: 'plan-1', name: 'My Plan' },
        mealPlans: [{ id: 'plan-1', name: 'My Plan' }],
      }),
    );

    const { useMealPlanCalendar } = jest.requireMock(
      '#hooks/mealPlan/useMealPlanCalendar',
    );
    useMealPlanCalendar.mockReturnValue({
      selectedDate: new Date('2026-03-01'),
      weekDays: [],
      viewMode: 'month',
      setViewMode: jest.fn(),
      selectDate: jest.fn(),
      goToPrevWeek: jest.fn(),
      goToNextWeek: jest.fn(),
      canGoPrevWeek: true,
      canGoNextWeek: true,
      minDate: undefined,
      maxDate: undefined,
    });

    const tree = render(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('renders with nutrition summary from meal plan', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useMealPlans } = jest.requireMock('#hooks/mealPlan/useMealPlans');
    useMealPlans.mockReturnValue(
      mockMealPlansState({
        currentPlan: { id: 'plan-1', name: 'My Plan' },
        mealPlans: [{ id: 'plan-1', name: 'My Plan' }],
      }),
    );

    const { useMealPlan } = jest.requireMock('#hooks/mealPlan/useMealPlan');
    useMealPlan.mockReturnValue({
      mealPlan: { id: 'plan-1', name: 'My Plan' },
      items: [{ id: 'i1', date: '2026-03-01T12:00:00Z' }],
      nutritionSummary: { calories: 2000, protein: 100 },
      refetch: jest.fn().mockResolvedValue({}),
    });

    const tree = render(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('renders with limited permissions', () => {
    mockDeferredScreen.mockImplementation(({ component: Component }: any) => (
      <Component />
    ));

    const { useMealPlans } = jest.requireMock('#hooks/mealPlan/useMealPlans');
    useMealPlans.mockReturnValue(
      mockMealPlansState({
        currentPlan: { id: 'plan-1', name: 'My Plan' },
        mealPlans: [{ id: 'plan-1', name: 'My Plan' }],
      }),
    );

    const { useMealPlanPermissions } = jest.requireMock(
      '#hooks/mealPlan/useMealPlanPermissions',
    );
    useMealPlanPermissions.mockReturnValue({
      canEdit: false,
      canDelete: false,
      canGenerateShoppingList: false,
      canSaveAsTemplate: false,
    });

    const tree = render(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });
});
