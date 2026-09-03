'use no memo';
import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithApollo as render } from '#/test-utils/apolloMockProvider';
import { MealPlanSettingsSheet } from '../MealPlanSettingsSheet';
import type { MealPlanSettingsSheet_MealPlanFragment } from '../MealPlanSettingsSheet.generated';
import type { MealPlanPermissions } from '#features/mealPlan/utils/mealPlanPermissions';

type MealPlanSettingsSheetProps = React.ComponentProps<
  typeof MealPlanSettingsSheet
>;

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
  })),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#components/atoms/BottomSheetHeader', () => ({
  BottomSheetHeader: ({
    title,
    onCancel,
    onConfirm,
    confirmLabel,
  }: {
    title: string;
    onCancel: () => void;
    onConfirm: () => void;
    confirmLabel: string;
  }) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID="bottom-sheet-header">
        <Text>{title}</Text>
        <Pressable onPress={onCancel} testID="cancel-button">
          <Text>Cancel</Text>
        </Pressable>
        <Pressable onPress={onConfirm} testID="confirm-button">
          <Text>{confirmLabel}</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('../NutritionSummaryCard', () => ({
  NutritionSummaryCard: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="nutrition-summary-card">
        <Text>Nutrition Summary</Text>
      </View>
    );
  },
}));

const makeMealPlan = (
  overrides?: Partial<MealPlanSettingsSheet_MealPlanFragment>,
): MealPlanSettingsSheet_MealPlanFragment => ({
  __typename: 'MealPlan',
  id: 'mp-1',
  name: 'Weekly Plan',
  description: 'My meal plan description',
  startDate: '2024-03-01',
  endDate: '2024-03-07',
  budgetAmount: null,
  actualCost: 0,
  dietaryProfile: null,
  home: { __typename: 'Home', id: 'home-1', name: 'My Home' },
  createdBy: {
    __typename: 'User',
    id: 'user-1',
    profile: {
      __typename: 'UserProfile',
      id: 'profile-1',
      displayName: 'John Doe',
    },
  },
  nutritionSummary: {
    __typename: 'MealPlanNutritionSummary',
    totalCalories: 0,
    avgDailyCalories: 0,
    avgDailyProtein: 0,
    avgDailyCarbs: 0,
    avgDailyFat: 0,
    totalMeals: 0,
    mealsWithNutrition: 0,
    coveragePercentage: 0,
  },
  nutritionGoalProgress: null,
  generatedShoppingLists: [],
  ...overrides,
});

const defaultPermissions: MealPlanPermissions = {
  canDelete: true,
  canEdit: true,
  canDuplicate: true,
  canGenerateShoppingList: true,
  canSaveAsTemplate: true,
};

const defaultProps: MealPlanSettingsSheetProps = {
  visible: true,
  mealPlanRef: makeMealPlan(),
  permissions: defaultPermissions,
  onClose: jest.fn(),
  onDuplicate: jest.fn(),
  onGenerateShoppingList: jest.fn(),
  onDelete: jest.fn(),
  deleting: false,
};

describe('MealPlanSettingsSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Plan Settings header', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('Plan Settings')).toBeTruthy();
  });

  it('renders null when mealPlan is null', () => {
    render(<MealPlanSettingsSheet {...defaultProps} mealPlanRef={null} />);
    expect(screen.queryByText('Plan Settings')).toBeNull();
  });

  it('renders the plan name', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('Weekly Plan')).toBeTruthy();
  });

  it('renders the plan description', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('My meal plan description')).toBeTruthy();
  });

  it('renders the date range', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('Mar 1 - Mar 7, 2024')).toBeTruthy();
  });

  it('renders the home name', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('Shared with My Home')).toBeTruthy();
  });

  it('renders the creator name', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('Created by John Doe')).toBeTruthy();
  });

  it('shows spend vs budget when a budget is set', () => {
    render(
      <MealPlanSettingsSheet
        {...defaultProps}
        mealPlanRef={makeMealPlan({ budgetAmount: 50, actualCost: 30 })}
      />,
    );
    expect(screen.getByText('Spent $30.00 of $50.00')).toBeTruthy();
  });

  it('renders action items', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('Generate Shopping List')).toBeTruthy();
    expect(screen.getByText('Duplicate Plan')).toBeTruthy();
    expect(screen.getByText('View Nutrition')).toBeTruthy();
  });

  it('renders Delete Plan when user has delete permission', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('Delete Plan')).toBeTruthy();
  });

  it('does not render Delete Plan when user lacks delete permission', () => {
    render(
      <MealPlanSettingsSheet
        {...defaultProps}
        permissions={{ ...defaultPermissions, canDelete: false }}
      />,
    );
    expect(screen.queryByText('Delete Plan')).toBeNull();
  });

  it('shows Deleting... text when deleting', () => {
    render(<MealPlanSettingsSheet {...defaultProps} deleting={true} />);
    expect(screen.getByText('Deleting...')).toBeTruthy();
  });

  it('does not show description when not provided', () => {
    render(
      <MealPlanSettingsSheet
        {...defaultProps}
        mealPlanRef={makeMealPlan({ description: null })}
      />,
    );
    expect(screen.queryByText('My meal plan description')).toBeNull();
  });

  it('renders generated shopping lists when they exist', () => {
    const mealPlan = makeMealPlan({
      generatedShoppingLists: [
        { __typename: 'ShoppingList', id: 'sl-1', name: 'Grocery Run 1' },
        { __typename: 'ShoppingList', id: 'sl-2', name: 'Grocery Run 2' },
      ],
    });
    render(<MealPlanSettingsSheet {...defaultProps} mealPlanRef={mealPlan} />);
    expect(screen.getByText('Generated Lists')).toBeTruthy();
    expect(screen.getByText('Grocery Run 1')).toBeTruthy();
    expect(screen.getByText('Grocery Run 2')).toBeTruthy();
  });
});
