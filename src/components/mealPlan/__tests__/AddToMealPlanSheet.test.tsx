'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { AddToMealPlanSheet } from '../AddToMealPlanSheet';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
  })),
}));

jest.mock('#components/atoms/BottomSheetHeader', () => ({
  BottomSheetHeader: ({ title, onCancel, onConfirm, confirmLabel, confirmDisabled }: any) => {
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(RN.View, { testID: 'header' },
      R.createElement(RN.Text, null, title),
      R.createElement(RN.Pressable, { onPress: onCancel, testID: 'cancel-btn' }, R.createElement(RN.Text, null, 'Cancel')),
      R.createElement(RN.Pressable, { onPress: onConfirm, testID: 'confirm-btn', disabled: confirmDisabled },
        R.createElement(RN.Text, null, confirmLabel)),
    );
  },
}));

jest.mock('#generated', () => ({
  MealType: {
    Breakfast: 'BREAKFAST',
    Brunch: 'BRUNCH',
    Lunch: 'LUNCH',
    Snack: 'SNACK',
    Dinner: 'DINNER',
    Dessert: 'DESSERT',
  },
}));

jest.mock('#hooks/mealPlan/useAddRecipeToMealPlan', () => ({
  useAddRecipeToMealPlan: jest.fn(() => ({
    addRecipeToMealPlan: jest.fn(() => Promise.resolve(true)),
    adding: false,
    hasPlan: true,
    mealPlans: [{ id: 'plan-1', name: 'Week Plan', startDate: '2024-01-01', endDate: '2024-01-07' }],
    activePlanId: 'plan-1',
  })),
}));

jest.mock('#hooks/mealPlan/useMealPlanCalendar', () => ({
  useMealPlanCalendar: jest.fn(() => ({
    weekDays: [],
    selectedDate: new Date('2024-01-03'),
    selectDate: jest.fn(),
    goToPrevWeek: jest.fn(),
    goToNextWeek: jest.fn(),
    canGoPrevWeek: true,
    canGoNextWeek: true,
  })),
}));

jest.mock('#components/mealPlan/WeekStrip', () => ({
  WeekStrip: () => {
    const { Text } = require('react-native');
    return require('react').createElement(Text, null, 'WeekStrip');
  },
}));

describe('AddToMealPlanSheet', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    recipeId: 'recipe-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    render(<AddToMealPlanSheet {...defaultProps} />);
    expect(screen.getByText('Add to Meal Plan')).toBeTruthy();
  });

  it('renders all meal type options', () => {
    render(<AddToMealPlanSheet {...defaultProps} />);
    expect(screen.getByText('Breakfast')).toBeTruthy();
    expect(screen.getByText('Lunch')).toBeTruthy();
    expect(screen.getByText('Dinner')).toBeTruthy();
    expect(screen.getByText('Snack')).toBeTruthy();
  });

  it('renders Meal Type section label', () => {
    render(<AddToMealPlanSheet {...defaultProps} />);
    expect(screen.getByText('Meal Type')).toBeTruthy();
  });

  it('renders Date section label when plan exists', () => {
    render(<AddToMealPlanSheet {...defaultProps} />);
    expect(screen.getByText('Date')).toBeTruthy();
  });

  it('shows warning when no active plan', () => {
    const useAddRecipeToMealPlan = require('#hooks/mealPlan/useAddRecipeToMealPlan').useAddRecipeToMealPlan;
    useAddRecipeToMealPlan.mockReturnValue({
      addRecipeToMealPlan: jest.fn(),
      adding: false,
      hasPlan: false,
      mealPlans: [],
      activePlanId: null,
    });
    render(<AddToMealPlanSheet {...defaultProps} />);
    expect(screen.getByText('No active meal plan. Create one first.')).toBeTruthy();
  });
});
