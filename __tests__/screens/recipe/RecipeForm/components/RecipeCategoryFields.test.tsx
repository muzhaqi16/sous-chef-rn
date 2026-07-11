'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { RecipeCategoryFields } from '#features/recipes/screens/RecipeForm/components/RecipeCategoryFields';
import type { RecipeFormState } from '#features/recipes/screens/RecipeForm/useRecipeForm';
import { Difficulty, RecipeStatus } from '#/graphql/generated/schemaTypes';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('../../../../../src/components/molecules/FormInput', () => ({
  FormInput: (props: { label?: string }) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));
jest.mock('../../../../../src/components/molecules/SegmentedControl', () => ({
  SegmentedControl: (props: { label?: string }) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));

describe('RecipeCategoryFields', () => {
  const defaultState: RecipeFormState = {
    name: 'Test Recipe',
    description: '',
    imageUrl: '',
    servings: '4',
    prepTimeMinutes: '10',
    cookTimeMinutes: '20',
    caloriesPerServing: '',
    difficulty: Difficulty.Medium,
    category: null,
    cuisine: 'Italian',
    status: RecipeStatus.Draft,
    diets: [],
    healthGoals: [],
    intolerances: [],
    ingredients: [],
    steps: [],
    notes: '',
    tips: '',
    originalAuthor: '',
    tags: '',
  };

  const updateField = jest.fn();

  it('renders without crashing', () => {
    const { toJSON } = render(
      <RecipeCategoryFields state={defaultState} updateField={updateField} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders Difficulty segmented control', () => {
    const { getByText } = render(
      <RecipeCategoryFields state={defaultState} updateField={updateField} />,
    );
    expect(getByText('Difficulty')).toBeTruthy();
  });

  it('renders Cuisine input', () => {
    const { getByText } = render(
      <RecipeCategoryFields state={defaultState} updateField={updateField} />,
    );
    expect(getByText('Cuisine')).toBeTruthy();
  });

  it('renders Status segmented control', () => {
    const { getByText } = render(
      <RecipeCategoryFields state={defaultState} updateField={updateField} />,
    );
    expect(getByText('Status')).toBeTruthy();
  });
});
