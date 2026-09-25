'use no memo';

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RecipeCategoryFields } from '#features/recipes/components/recipeForm/RecipeCategoryFields';
import type { RecipeFormState } from '#features/recipes/screens/RecipeForm/formState';
import {
  Cuisine,
  Difficulty,
  RecipeStatus,
} from '#/graphql/generated/schemaTypes';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#components/molecules/AnimatedChip', () => ({
  AnimatedChip: ({
    label,
    onPress,
  }: {
    label?: string;
    onPress?: () => void;
  }) => {
    const { Text } = require('react-native');
    return <Text onPress={onPress}>{label}</Text>;
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
    videoUrl: '',
    servings: '4',
    prepTimeMinutes: '10',
    cookTimeMinutes: '20',
    caloriesPerServing: '',
    difficulty: Difficulty.Medium,
    category: null,
    cuisines: [Cuisine.Italian],
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

  it('renders the cuisine chips', () => {
    const { getByText } = render(
      <RecipeCategoryFields state={defaultState} updateField={updateField} />,
    );
    expect(getByText('Cuisine')).toBeTruthy();
    expect(getByText('Italian')).toBeTruthy();
  });

  // The API takes a list of enum members, so a chip adds or removes one.
  it('adds a tapped cuisine and removes a selected one', () => {
    const { getByText } = render(
      <RecipeCategoryFields state={defaultState} updateField={updateField} />,
    );

    fireEvent.press(getByText('Mexican'));
    expect(updateField).toHaveBeenLastCalledWith('cuisines', [
      Cuisine.Italian,
      Cuisine.Mexican,
    ]);

    fireEvent.press(getByText('Italian'));
    expect(updateField).toHaveBeenLastCalledWith('cuisines', []);
  });

  it('renders Status segmented control', () => {
    const { getByText } = render(
      <RecipeCategoryFields state={defaultState} updateField={updateField} />,
    );
    expect(getByText('Status')).toBeTruthy();
  });
});
