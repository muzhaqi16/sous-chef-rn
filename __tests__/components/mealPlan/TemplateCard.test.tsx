'use no memo';

import React from 'react';
import { userEvent } from '@testing-library/react-native';
import { TemplateCategory } from '../../../src/graphql/generated/schemaTypes';
import type { MealTemplateDisplayFragment } from '../../../src/features/mealPlan/graphql/mealPlanFragments.generated';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { TemplateCard } from '../../../src/features/mealPlan/components/TemplateCard';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

// TemplateCard uses useFragment to subscribe to per-entity cache updates.
// Wrapping with MockedProvider lets the hook's useApolloClient() resolve;
// the in-test cache miss is expected (renderer falls back to source prop).
const render = renderWithApollo;

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
    const { getByText } = render(
      <TemplateCard template={makeTemplate()} onPress={onPress} />,
    );
    expect(getByText('Weekly Dinner Plan')).toBeTruthy();
  });

  it('renders description', () => {
    const { getByText } = render(
      <TemplateCard template={makeTemplate()} onPress={onPress} />,
    );
    expect(getByText('A balanced dinner plan')).toBeTruthy();
  });

  it('shows usage count', () => {
    const { getByText } = render(
      <TemplateCard template={makeTemplate()} onPress={onPress} />,
    );
    expect(getByText('Used 3x')).toBeTruthy();
  });

  it('renders duration and servings meta', () => {
    const { getByText } = render(
      <TemplateCard template={makeTemplate()} onPress={onPress} />,
    );
    expect(getByText('7 days')).toBeTruthy();
    expect(getByText('4 servings')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const user = userEvent.setup();
    const template = makeTemplate();
    const { getByText } = render(
      <TemplateCard template={template} onPress={onPress} />,
    );
    await user.press(getByText('Weekly Dinner Plan'));
    expect(onPress).toHaveBeenCalledWith(template);
  });
});
