'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { RecipeCategoryFields } from '#features/recipes/screens/RecipeForm/components/RecipeCategoryFields';
import { Difficulty, RecipeStatus } from '#/graphql/generated/schemaTypes';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

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
    status: RecipeStatus.Draft,
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

  it('renders Status segmented control', () => {
    const { getByText } = render(
      <RecipeCategoryFields state={defaultState as any} updateField={updateField} />,
    );
    expect(getByText('Status')).toBeTruthy();
  });
});
