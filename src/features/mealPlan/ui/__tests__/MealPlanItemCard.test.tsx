import React from 'react';
import { screen } from '@testing-library/react-native';
import {
  renderWithApollo,
  seedCache,
  toFragmentRef,
} from '#/test-utils/apolloMockProvider';
import { Icon } from '#components/atoms/Icon';
import { SwipeableItem } from '#components/organisms/SwipeableItem/SwipeableItem';
import { MealPlanItemCard } from '../MealPlanItemCard';
import {
  MealPlanItemCard_ItemFragmentDoc,
  type MealPlanItemCard_ItemFragment,
} from '../MealPlanItemCard.generated';

const meal = (
  totalTimeMinutes: number | null,
): MealPlanItemCard_ItemFragment => ({
  __typename: 'MealPlanItem',
  version: 1,
  id: 'mpi-1',
  isCompleted: false,
  customMealName: null,
  servings: null,
  calories: null,
  usedPantryItems: [],
  recipe: {
    __typename: 'Recipe',
    version: 1,
    id: 'r-1',
    name: 'Pizza',
    imageUrl: null,
    totalTimeMinutes,
  },
});

const ref = toFragmentRef<typeof MealPlanItemCard_ItemFragmentDoc>({
  __typename: 'MealPlanItem',
  version: 1,
  id: 'mpi-1',
});

const renderCard = (item: MealPlanItemCard_ItemFragment | null) =>
  renderWithApollo(<MealPlanItemCard item={ref} />, {
    cache: seedCache(
      item
        ? [
            {
              data: item,
              fragment: MealPlanItemCard_ItemFragmentDoc,
              fragmentName: 'MealPlanItemCard_item',
            },
          ]
        : [],
    ),
  });

describe('MealPlanItemCard', () => {
  // A recipe with no known time stores 0.
  it('shows no time for a recipe whose time is 0', () => {
    renderCard(meal(0));

    expect(screen.getByText('Pizza')).toBeTruthy();
    expect(screen.queryByText('0 min')).toBeNull();
  });

  it('shows the time a recipe takes', () => {
    renderCard(meal(25));

    expect(screen.getByText('25 min')).toBeTruthy();
  });

  // RNGH's button would derive it: the toggle's "Mark not complete" and the
  // check icon's glyph stood in for the meal's state.
  it('names the row with the meal, its state and its details', () => {
    renderCard({ ...meal(25), isCompleted: true });

    expect(screen.getByLabelText('Pizza, Done, 25 min')).toBeTruthy();
  });

  // Today lists meals with no section heading and no actions.
  it('reads as one meal, named by its meal type, with nothing to press', () => {
    renderWithApollo(<MealPlanItemCard item={ref} mealTypeLabel="Dinner" />, {
      cache: seedCache([
        {
          data: meal(25),
          fragment: MealPlanItemCard_ItemFragmentDoc,
          fragmentName: 'MealPlanItemCard_item',
        },
      ]),
    });

    expect(screen.getByText('Dinner · 25 min')).toBeTruthy();
    expect(screen.queryByLabelText('Mark as complete')).toBeNull();
    expect(screen.queryByLabelText(/Mark/)).toBeNull();
    // No swipe gesture to sit in Today's plain scroll host, and no empty
    // circle that reads as a control.
    expect(screen.UNSAFE_queryByType(SwipeableItem)).toBeNull();
    expect(screen.UNSAFE_queryAllByType(Icon)).toEqual([]);
  });

  it('marks a done meal in a read-only row', () => {
    renderWithApollo(<MealPlanItemCard item={ref} mealTypeLabel="Dinner" />, {
      cache: seedCache([
        {
          data: { ...meal(25), isCompleted: true },
          fragment: MealPlanItemCard_ItemFragmentDoc,
          fragmentName: 'MealPlanItemCard_item',
        },
      ]),
    });

    expect(screen.getByLabelText('Pizza, Done, Dinner · 25 min')).toBeTruthy();
    expect(
      screen.UNSAFE_getAllByType(Icon).map(icon => icon.props.name),
    ).toEqual(['checkmark-circle']);
  });

  it('renders nothing while the item is not completely cached', () => {
    renderCard(null);

    expect(screen.queryByText('Pizza')).toBeNull();
  });
});
