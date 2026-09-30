'use no memo';

import React from 'react';
import { userEvent } from '@testing-library/react-native';
import { TemplateCategory } from '../../../src/graphql/generated/schemaTypes';
import {
  MealTemplateDisplayFragmentDoc,
  type MealTemplateDisplayFragment,
} from '../../../src/features/mealPlan/graphql/mealPlanFragments.generated';
import {
  renderWithApollo,
  seedCache,
  toFragmentRef,
} from '#/test-utils/apolloMockProvider';
import { TemplateCard } from '../../../src/features/mealPlan/components/TemplateCard';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

/** A strict cell: the template is read from the cache, the prop is its key. */
const renderCard = (
  template: MealTemplateDisplayFragment | null,
  onPress: (template: MealTemplateDisplayFragment) => void,
) =>
  renderWithApollo(
    <TemplateCard
      template={toFragmentRef<typeof MealTemplateDisplayFragmentDoc>({
        __typename: 'MealTemplate',
        id: 't1',
      })}
      onPress={onPress}
    />,
    {
      cache: seedCache(
        template
          ? [
              {
                data: template,
                fragment: MealTemplateDisplayFragmentDoc,
                fragmentName: 'MealTemplateDisplay',
              },
            ]
          : [],
      ),
    },
  );

const makeTemplate = (
  overrides: Partial<MealTemplateDisplayFragment> = {},
): MealTemplateDisplayFragment => ({
  __typename: 'MealTemplate',
  id: 't1',
  name: 'Weekly Dinner Plan',
  description: 'A balanced dinner plan',
  category: TemplateCategory.Weekly,
  durationDays: 7,
  defaultServings: 4,
  usageCount: 3,
  tags: ['healthy', 'quick'],
  lastUsedAt: null,
  homeId: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  home: null,
  user: { __typename: 'User', id: 'u1' },
  ...overrides,
});

describe('TemplateCard', () => {
  const onPress = jest.fn();

  it('renders template name', () => {
    const { getByText } = renderCard(makeTemplate(), onPress);
    expect(getByText('Weekly Dinner Plan')).toBeTruthy();
  });

  it('renders description', () => {
    const { getByText } = renderCard(makeTemplate(), onPress);
    expect(getByText('A balanced dinner plan')).toBeTruthy();
  });

  it('shows usage count', () => {
    const { getByText } = renderCard(makeTemplate(), onPress);
    expect(getByText('Used 3x')).toBeTruthy();
  });

  it('renders duration and servings meta', () => {
    const { getByText } = renderCard(makeTemplate(), onPress);
    expect(getByText('7 days')).toBeTruthy();
    expect(getByText('4 servings')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const user = userEvent.setup();
    const template = makeTemplate();
    const { getByText } = renderCard(template, onPress);
    await user.press(getByText('Weekly Dinner Plan'));
    expect(onPress).toHaveBeenCalledWith(template);
  });

  it('renders nothing while the template is not completely cached', () => {
    const { queryByText } = renderCard(null, onPress);
    expect(queryByText('Weekly Dinner Plan')).toBeNull();
  });
});
