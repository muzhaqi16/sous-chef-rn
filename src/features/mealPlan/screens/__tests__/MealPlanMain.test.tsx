'use no memo';

import React from 'react';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
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

type DeferredScreenMockProps = {
  fallback: React.ReactNode;
  component: React.ComponentType;
};

const mockMealPlansState = (overrides: Record<string, unknown> = {}) => ({
  state: {
    currentPlan: null,
    mealPlans: [],
    loading: false,
    initialLoading: false,
    error: undefined,
    // A response arrived. Without this the screen cannot tell an empty plan
    // list from a fetch that never answered, and must assume the latter.
    hasResult: true,
    totalCount: undefined,
    hasMore: false,
    ...overrides,
  },
  actions: { refetch: jest.fn(), loadMore: jest.fn() },
});

jest.mock('#features/mealPlan/hooks/useMealPlans', () => ({
  useMealPlans: jest.fn(() => mockMealPlansState()),
}));

jest.mock('#features/mealPlan/hooks/useMealPlan', () => ({
  useMealPlan: jest.fn(() => ({
    mealPlan: null,
    items: [],
    nutritionSummary: null,
    refetch: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('#features/mealPlan/hooks/useMealPlanItemActions', () => ({
  useMealPlanItemActions: jest.fn(() => ({
    createItem: jest.fn(),
    updateItem: jest.fn(),
    toggleCompleted: jest.fn(),
    deleteItem: jest.fn(),
  })),
}));

jest.mock('#features/mealPlan/hooks/useMealPlanCalendar', () => ({
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

jest.mock('#features/mealPlan/hooks/useDailyMeals', () => ({
  useDailyMeals: jest.fn(() => ({
    dailyMeals: [],
    totalCalories: 0,
    isEmpty: true,
  })),
}));

jest.mock('#features/mealPlan/hooks/useMealTemplateActions', () => ({
  useMealTemplateActions: jest.fn(() => ({
    createPlanFromTemplate: jest.fn(),
    createTemplateFromPlan: jest.fn(),
    creatingFromTemplate: false,
    creatingTemplate: false,
  })),
}));

jest.mock('#features/mealPlan/hooks/useMealPlanSelectorConfig', () => ({
  useMealPlanSelectorConfig: jest.fn(() => ({})),
}));

jest.mock('#features/mealPlan/hooks/useGenerateShoppingList', () => ({
  useGenerateShoppingList: jest.fn(() => ({
    generateShoppingList: jest.fn(),
    loading: false,
  })),
}));

jest.mock('#features/mealPlan/hooks/useDuplicateMealPlan', () => ({
  useDuplicateMealPlan: jest.fn(() => ({
    duplicatePlan: jest.fn(),
    loading: false,
  })),
}));

jest.mock('#features/mealPlan/hooks/useMealPlanPermissions', () => ({
  useMealPlanPermissions: jest.fn(() => ({
    canEdit: true,
    canDelete: true,
    canGenerateShoppingList: true,
    canSaveAsTemplate: true,
  })),
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn(() => null),
  // useMealPlanActions reads the auth identity to materialize local-first
  // optimistic plans; null keeps the legacy online-only path in these tests.
  useUser: jest.fn(() => null),
  // The header's OfflineStatusPill reads online status; keep it online so the
  // pill stays hidden in these tests.
  useIsOnline: jest.fn(() => true),
}));

jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

jest.mock('#hooks/performance/useTabScreenLifecycle', () => ({
  useTabScreenLifecycle: jest.fn(),
}));

const mockDeferredScreen = jest.fn(
  ({ fallback }: DeferredScreenMockProps) => fallback,
);
jest.mock('#components/molecules/WeekStrip', () => ({
  WeekStrip: () => null,
}));
jest.mock('#features/mealPlan/components/MonthCalendar', () => ({
  MonthCalendar: () => null,
}));
jest.mock('#features/mealPlan/components/DayMealList', () => ({
  DayMealList: () => null,
}));
jest.mock('#features/mealPlan/components/CalendarToggleBar', () => ({
  CalendarToggleBar: () => null,
}));
jest.mock('#features/mealPlan/components/MealPlanEmptyState', () => {
  const { View } = require('react-native');
  return {
    MealPlanEmptyState: () => <View testID="meal-plan-empty-state" />,
  };
});
jest.mock('#features/mealPlan/components/AddMealSheet', () => ({
  AddMealSheet: () => null,
}));
jest.mock('#features/mealPlan/components/SaveAsTemplateSheet', () => ({
  SaveAsTemplateSheet: () => null,
}));
jest.mock('#features/mealPlan/components/TemplateBrowserSheet', () => ({
  TemplateBrowserSheet: () => null,
}));
jest.mock('#features/mealPlan/components/TemplatePreviewSheet', () => ({
  TemplatePreviewSheet: () => null,
}));
jest.mock('#features/mealPlan/components/GenerateShoppingListSheet', () => ({
  GenerateShoppingListSheet: () => null,
}));
jest.mock('#features/mealPlan/components/MealPlanSettingsSheet', () => ({
  MealPlanSettingsSheet: () => null,
}));
jest.mock('#features/mealPlan/components/DuplicatePlanSheet', () => ({
  DuplicatePlanSheet: () => null,
}));
jest.mock('#features/mealPlan/components/NutritionSummaryCard', () => ({
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
  DeferredScreen: (props: DeferredScreenMockProps) => mockDeferredScreen(props),
}));

jest.mock('#features/mealPlan/components/skeletons/MealPlanSkeleton', () => {
  const { View } = require('react-native');
  return {
    MealPlanSkeleton: () => <View testID="meal-plan-skeleton" />,
  };
});

jest.mock('#components/molecules/TabScreenHeader', () => ({
  TabScreenHeader: ({ title }: { title: string }) => title,
}));

describe('MealPlanMain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with DeferredScreen fallback', () => {
    const { getByTestId } = renderWithApollo(<MealPlanMain />);
    expect(getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('shows TabScreenHeader in fallback', () => {
    const tree = renderWithApollo(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('renders inner component when DeferredScreen renders component', () => {
    // Override to render the component prop
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: DeferredScreenMockProps) => <Component />,
    );

    const { useMealPlans } = jest.requireMock(
      '#features/mealPlan/hooks/useMealPlans',
    );
    useMealPlans.mockReturnValue(mockMealPlansState());

    const { getByTestId } = renderWithApollo(<MealPlanMain />);
    expect(getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('shows empty state when no meal plans exist', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: DeferredScreenMockProps) => <Component />,
    );

    const { useMealPlans } = jest.requireMock(
      '#features/mealPlan/hooks/useMealPlans',
    );
    useMealPlans.mockReturnValue(mockMealPlansState());

    const tree = renderWithApollo(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
    expect(tree.queryByTestId('meal-plan-empty-state')).toBeTruthy();
  });

  it('offers a retry, not "create a plan", when the plan fetch failed', () => {
    // The empty state's calls to action are "Create plan" and "Create from
    // template". After a failed fetch the app does not know whether this
    // person already has plans, so offering to create one invites a duplicate
    // of something they already own.
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: DeferredScreenMockProps) => <Component />,
    );

    const { useMealPlans } = jest.requireMock(
      '#features/mealPlan/hooks/useMealPlans',
    );
    useMealPlans.mockReturnValue(
      mockMealPlansState({ hasResult: false, error: new Error('500') }),
    );

    const tree = renderWithApollo(<MealPlanMain />);
    expect(tree.queryByTestId('meal-plan-empty-state')).toBeNull();
    expect(tree.getByTestId('state-error')).toBeTruthy();
  });

  it('keeps the skeleton up while the first plan fetch is in flight', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: DeferredScreenMockProps) => <Component />,
    );

    const { useMealPlans } = jest.requireMock(
      '#features/mealPlan/hooks/useMealPlans',
    );
    useMealPlans.mockReturnValue(
      mockMealPlansState({ loading: true, initialLoading: true }),
    );

    const tree = renderWithApollo(<MealPlanMain />);
    expect(tree.queryByTestId('meal-plan-skeleton')).toBeTruthy();
    expect(tree.queryByTestId('meal-plan-empty-state')).toBeNull();
  });

  it('shows the empty state while a refetch runs over an empty cached list', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: DeferredScreenMockProps) => <Component />,
    );

    const { useMealPlans } = jest.requireMock(
      '#features/mealPlan/hooks/useMealPlans',
    );
    useMealPlans.mockReturnValue(
      mockMealPlansState({ loading: true, initialLoading: false }),
    );

    const tree = renderWithApollo(<MealPlanMain />);
    expect(tree.queryByTestId('meal-plan-empty-state')).toBeTruthy();
    expect(tree.queryByTestId('meal-plan-skeleton')).toBeNull();
  });

  it('renders meal plan content when plans exist', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: DeferredScreenMockProps) => <Component />,
    );

    const { useMealPlans } = jest.requireMock(
      '#features/mealPlan/hooks/useMealPlans',
    );
    useMealPlans.mockReturnValue(
      mockMealPlansState({
        currentPlan: { id: 'plan-1', name: 'My Plan' },
        mealPlans: [{ id: 'plan-1', name: 'My Plan' }],
      }),
    );

    const tree = renderWithApollo(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('renders with loading state from useMealPlans', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: DeferredScreenMockProps) => <Component />,
    );

    const { useMealPlans } = jest.requireMock(
      '#features/mealPlan/hooks/useMealPlans',
    );
    useMealPlans.mockReturnValue(mockMealPlansState({ loading: true }));

    const tree = renderWithApollo(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('renders with non-empty daily meals', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: DeferredScreenMockProps) => <Component />,
    );

    const { useMealPlans } = jest.requireMock(
      '#features/mealPlan/hooks/useMealPlans',
    );
    useMealPlans.mockReturnValue(
      mockMealPlansState({
        currentPlan: { id: 'plan-1', name: 'My Plan' },
        mealPlans: [{ id: 'plan-1', name: 'My Plan' }],
      }),
    );

    const { useDailyMeals } = jest.requireMock(
      '#features/mealPlan/hooks/useDailyMeals',
    );
    useDailyMeals.mockReturnValue({
      dailyMeals: [
        { mealType: 'BREAKFAST', items: [{ id: 'item-1', name: 'Oatmeal' }] },
      ],
      totalCalories: 350,
      isEmpty: false,
    });

    const tree = renderWithApollo(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('renders with multiple meal plans', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: DeferredScreenMockProps) => <Component />,
    );

    const { useMealPlans } = jest.requireMock(
      '#features/mealPlan/hooks/useMealPlans',
    );
    useMealPlans.mockReturnValue(
      mockMealPlansState({
        currentPlan: { id: 'plan-1', name: 'Plan 1' },
        mealPlans: [
          { id: 'plan-1', name: 'Plan 1' },
          { id: 'plan-2', name: 'Plan 2' },
        ],
      }),
    );

    const tree = renderWithApollo(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('renders with month view mode', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: DeferredScreenMockProps) => <Component />,
    );

    const { useMealPlans } = jest.requireMock(
      '#features/mealPlan/hooks/useMealPlans',
    );
    useMealPlans.mockReturnValue(
      mockMealPlansState({
        currentPlan: { id: 'plan-1', name: 'My Plan' },
        mealPlans: [{ id: 'plan-1', name: 'My Plan' }],
      }),
    );

    const { useMealPlanCalendar } = jest.requireMock(
      '#features/mealPlan/hooks/useMealPlanCalendar',
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

    const tree = renderWithApollo(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('renders with nutrition summary from meal plan', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: DeferredScreenMockProps) => <Component />,
    );

    const { useMealPlans } = jest.requireMock(
      '#features/mealPlan/hooks/useMealPlans',
    );
    useMealPlans.mockReturnValue(
      mockMealPlansState({
        currentPlan: { id: 'plan-1', name: 'My Plan' },
        mealPlans: [{ id: 'plan-1', name: 'My Plan' }],
      }),
    );

    const { useMealPlan } = jest.requireMock(
      '#features/mealPlan/hooks/useMealPlan',
    );
    useMealPlan.mockReturnValue({
      mealPlan: { id: 'plan-1', name: 'My Plan' },
      items: [{ id: 'i1', date: '2026-03-01T12:00:00Z' }],
      nutritionSummary: { calories: 2000, protein: 100 },
      refetch: jest.fn().mockResolvedValue({}),
    });

    const tree = renderWithApollo(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });

  it('renders with limited permissions', () => {
    mockDeferredScreen.mockImplementation(
      ({ component: Component }: DeferredScreenMockProps) => <Component />,
    );

    const { useMealPlans } = jest.requireMock(
      '#features/mealPlan/hooks/useMealPlans',
    );
    useMealPlans.mockReturnValue(
      mockMealPlansState({
        currentPlan: { id: 'plan-1', name: 'My Plan' },
        mealPlans: [{ id: 'plan-1', name: 'My Plan' }],
      }),
    );

    const { useMealPlanPermissions } = jest.requireMock(
      '#features/mealPlan/hooks/useMealPlanPermissions',
    );
    useMealPlanPermissions.mockReturnValue({
      canEdit: false,
      canDelete: false,
      canGenerateShoppingList: false,
      canSaveAsTemplate: false,
    });

    const tree = renderWithApollo(<MealPlanMain />);
    expect(tree.getByTestId('meal-plan-screen')).toBeTruthy();
  });
});
