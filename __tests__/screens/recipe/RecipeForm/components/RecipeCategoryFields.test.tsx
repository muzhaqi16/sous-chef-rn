'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { RecipeCategoryFields } from '../../../../../src/screens/recipe/RecipeForm/components/RecipeCategoryFields';
import { Difficulty, Visibility } from '../../../../../src/graphql/generated';

jest.mock('../../../../../src/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../../../src/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

jest.mock('../../../../../src/components/molecules/FormInput', () => ({
  FormInput: (props: any) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));
jest.mock('../../../../../src/components/molecules/SegmentedControl', () => ({
  SegmentedControl: (props: any) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));

describe('RecipeCategoryFields', () => {
  const defaultState = {
    title: 'Test Recipe',
    description: '',
    cuisine: 'Italian',
    difficulty: Difficulty.Medium,
    visibility: Visibility.Private,
    isPublished: false,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    servings: 4,
    ingredients: [],
    instructions: [],
    imageUrl: null,
    tags: [],
  };

  const updateField = jest.fn();

  it('renders without crashing', () => {
    const { toJSON } = render(
      <RecipeCategoryFields state={defaultState as any} updateField={updateField} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders Difficulty segmented control', () => {
    const { getByText } = render(
      <RecipeCategoryFields state={defaultState as any} updateField={updateField} />,
    );
    expect(getByText('Difficulty')).toBeTruthy();
  });

  it('renders Cuisine input', () => {
    const { getByText } = render(
      <RecipeCategoryFields state={defaultState as any} updateField={updateField} />,
    );
    expect(getByText('Cuisine')).toBeTruthy();
  });

  it('renders Visibility segmented control', () => {
    const { getByText } = render(
      <RecipeCategoryFields state={defaultState as any} updateField={updateField} />,
    );
    expect(getByText('Visibility')).toBeTruthy();
  });

  it('renders Published switch', () => {
    const { getByText } = render(
      <RecipeCategoryFields state={defaultState as any} updateField={updateField} />,
    );
    expect(getByText('Published')).toBeTruthy();
  });
});
