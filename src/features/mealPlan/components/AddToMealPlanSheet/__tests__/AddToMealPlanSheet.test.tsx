'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { MealType } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';
import { useMealPlans } from '#features/mealPlan/hooks/useMealPlans';
import { AddToMealPlanSheet } from '../AddToMealPlanSheet';

const mockAddRecipe = jest.fn(() => Promise.resolve(true));
const mockPlanState = () => ({
  addRecipeToMealPlan: mockAddRecipe,
  adding: false,
  hasPlan: true,
  mealPlans: [
    {
      id: 'plan-1',
      name: 'Week Plan',
      startDate: '2024-01-01',
      endDate: '2024-01-07',
    },
  ],
  activePlanId: 'plan-1',
});

jest.mock('#features/mealPlan/hooks/useAddRecipeToMealPlan', () => ({
  useAddRecipeToMealPlan: jest.fn(() => mockPlanState()),
}));

jest.mock('#features/mealPlan/hooks/useMealPlans', () => ({
  useMealPlans: jest.fn(),
}));

const mockSelectedDate = new Date('2024-01-03');
jest.mock('#features/mealPlan/hooks/useMealPlanCalendar', () => ({
  useMealPlanCalendar: jest.fn(() => ({
    weekDays: [],
    selectedDate: mockSelectedDate,
    selectDate: jest.fn(),
    goToPrevWeek: jest.fn(),
    goToNextWeek: jest.fn(),
    canGoPrevWeek: true,
    canGoNextWeek: true,
  })),
}));

jest.mock('#features/mealPlan/components/WeekStrip', () => ({
  WeekStrip: () => {
    const { Text } = require('react-native');
    return require('react').createElement(Text, null, 'WeekStrip');
  },
}));

const addButton = () => screen.getByRole('button', { name: t('labels.add') });

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

  it('adds the recipe on the meal picked, then closes', async () => {
    const user = userEvent.setup();
    render(<AddToMealPlanSheet {...defaultProps} />);

    await user.press(screen.getByText('Lunch'));
    await user.press(addButton());

    expect(mockAddRecipe).toHaveBeenCalledWith({
      recipeId: 'recipe-1',
      mealType: MealType.Lunch,
      date: mockSelectedDate,
    });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('opens fresh: the meal picked goes with the closing', async () => {
    const user = userEvent.setup();
    const view = render(
      <AddToMealPlanSheet {...defaultProps} initialMealType={MealType.Snack} />,
    );
    await user.press(screen.getByText('Lunch'));

    view.rerender(
      <AddToMealPlanSheet
        {...defaultProps}
        visible={false}
        initialMealType={MealType.Snack}
      />,
    );
    view.rerender(
      <AddToMealPlanSheet {...defaultProps} initialMealType={MealType.Snack} />,
    );
    await user.press(addButton());

    expect(mockAddRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ mealType: MealType.Snack }),
    );
  });

  // So an opening finds the plans held rather than saying there are none.
  it('reads the plans while closed', () => {
    render(<AddToMealPlanSheet {...defaultProps} visible={false} />);
    expect(useMealPlans).toHaveBeenCalledWith({ fetchPolicy: 'cache-first' });
  });

  it('shows warning when no active plan', () => {
    const useAddRecipeToMealPlan =
      require('#features/mealPlan/hooks/useAddRecipeToMealPlan').useAddRecipeToMealPlan;
    useAddRecipeToMealPlan.mockReturnValue({
      ...mockPlanState(),
      hasPlan: false,
      mealPlans: [],
      activePlanId: null,
    });
    render(<AddToMealPlanSheet {...defaultProps} />);
    expect(
      screen.getByText('No active meal plan. Create one first.'),
    ).toBeTruthy();
    expect(addButton()).toBeDisabled();
  });
});
