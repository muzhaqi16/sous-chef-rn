'use no memo';

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TemplateCard } from '../../../src/components/mealPlan/TemplateCard';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

const makeTemplate = (overrides = {}) => ({
  id: 't1',
  name: 'Weekly Dinner Plan',
  description: 'A balanced dinner plan',
  category: 'WEEKLY',
  durationDays: 7,
  defaultServings: 4,
  usageCount: 3,
  tags: ['healthy', 'quick'],
  home: null,
  ...overrides,
});

describe('TemplateCard', () => {
  const onPress = jest.fn();

  it('renders template name', () => {
    const { getByText } = render(
      <TemplateCard template={makeTemplate() as any} onPress={onPress} />,
    );
    expect(getByText('Weekly Dinner Plan')).toBeTruthy();
  });

  it('renders description', () => {
    const { getByText } = render(
      <TemplateCard template={makeTemplate() as any} onPress={onPress} />,
    );
    expect(getByText('A balanced dinner plan')).toBeTruthy();
  });

  it('shows usage count', () => {
    const { getByText } = render(
      <TemplateCard template={makeTemplate() as any} onPress={onPress} />,
    );
    expect(getByText('Used 3x')).toBeTruthy();
  });

  it('renders duration and servings meta', () => {
    const { getByText } = render(
      <TemplateCard template={makeTemplate() as any} onPress={onPress} />,
    );
    expect(getByText('7 days')).toBeTruthy();
    expect(getByText('4 servings')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const template = makeTemplate();
    const { getByText } = render(
      <TemplateCard template={template as any} onPress={onPress} />,
    );
    fireEvent.press(getByText('Weekly Dinner Plan'));
    expect(onPress).toHaveBeenCalledWith(template);
  });
});
