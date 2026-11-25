import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { t } from '#i18n';
import { MealPlanType } from '#graphql/generated/schemaTypes';
import {
  EMPTY_MEAL_PLAN_FILTERS,
  type MealPlanFilterState,
} from '#features/mealPlan/utils/mealPlanFilters';
import { MealPlanFilterBar } from '../MealPlanFilterBar';

const seen: MealPlanFilterState[] = [];

/** The bar as the plans screen holds it: its filters in the screen's state. */
const Host = () => {
  const [filters, setFilters] = useState(EMPTY_MEAL_PLAN_FILTERS);
  return (
    <MealPlanFilterBar
      filters={filters}
      onChange={next => {
        seen.push(next);
        setFilters(next);
      }}
    />
  );
};

const search = () =>
  screen.getByPlaceholderText(t('mealPlanSelector.searchPlaceholder'));

beforeEach(() => {
  seen.length = 0;
});

describe('MealPlanFilterBar', () => {
  it('searches as typed, and the ✕ clears the search', () => {
    render(<Host />);

    fireEvent.changeText(search(), 'week');
    expect(seen.at(-1)).toMatchObject({ search: 'week' });

    fireEvent.press(screen.getByLabelText('Clear input'));
    expect(seen.at(-1)).toMatchObject({ search: '' });
    expect(search()).toHaveDisplayValue('');
  });

  it('turns a plan type on and off again', () => {
    render(<Host />);

    fireEvent.press(screen.getByText(t('mealPlan.weekly')));
    expect(seen.at(-1)).toMatchObject({ planType: MealPlanType.Weekly });

    fireEvent.press(screen.getByText(t('mealPlan.weekly')));
    expect(seen.at(-1)).toMatchObject({ planType: null });
  });
});
