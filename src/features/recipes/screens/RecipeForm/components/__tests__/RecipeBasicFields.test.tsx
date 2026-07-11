'use no memo';

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RecipeBasicFields } from '../RecipeBasicFields';
import { RecipeStatus } from '#/graphql/generated/schemaTypes';

jest.mock('#components/molecules/FormInput', () => ({
  FormInput: ({
    label,
    value,
    onChangeText,
    placeholder,
    testID,
  }: React.ComponentProps<
    typeof import('#components/molecules/FormInput').FormInput
  >) => {
    const { View, Text, TextInput } = require('react-native');
    return (
      <View>
        <Text>{label}</Text>
        <TextInput
          testID={testID || `input-${label}`}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
        />
      </View>
    );
  },
}));

jest.mock('#components/molecules/FormTextArea', () => ({
  FormTextArea: ({
    label,
    value,
    onChangeText,
    placeholder,
  }: React.ComponentProps<
    typeof import('#components/molecules/FormTextArea').FormTextArea
  >) => {
    const { View, Text, TextInput } = require('react-native');
    return (
      <View>
        <Text>{label}</Text>
        <TextInput
          testID={`textarea-${label}`}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
        />
      </View>
    );
  },
}));

jest.mock('#components/molecules/EditableCounter', () => ({
  EditableCounter: ({
    label,
    value,
    onChangeText,
  }: React.ComponentProps<
    typeof import('#components/molecules/EditableCounter').EditableCounter
  >) => {
    const { View, Text, TextInput } = require('react-native');
    return (
      <View>
        <Text>{label}</Text>
        <TextInput
          testID={`counter-${label}`}
          value={value}
          onChangeText={onChangeText}
        />
      </View>
    );
  },
}));

const mockUpdateField = jest.fn();

const defaultState = {
  name: '',
  description: '',
  imageUrl: '',
  servings: '4',
  prepTimeMinutes: '',
  cookTimeMinutes: '',
  caloriesPerServing: '',
  difficulty: null,
  category: null,
  cuisine: '',
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RecipeBasicFields', () => {
  it('renders recipe name input', () => {
    const { getByText } = render(
      <RecipeBasicFields state={defaultState} updateField={mockUpdateField} />,
    );
    expect(getByText('Recipe Name')).toBeTruthy();
  });

  it('renders description textarea', () => {
    const { getByText } = render(
      <RecipeBasicFields state={defaultState} updateField={mockUpdateField} />,
    );
    expect(getByText('Description')).toBeTruthy();
  });

  it('renders image URL input', () => {
    const { getByText } = render(
      <RecipeBasicFields state={defaultState} updateField={mockUpdateField} />,
    );
    expect(getByText('Image URL')).toBeTruthy();
  });

  it('renders servings counter', () => {
    const { getByText } = render(
      <RecipeBasicFields state={defaultState} updateField={mockUpdateField} />,
    );
    expect(getByText('Servings')).toBeTruthy();
  });

  it('renders prep time and cook time counters', () => {
    const { getByText } = render(
      <RecipeBasicFields state={defaultState} updateField={mockUpdateField} />,
    );
    expect(getByText('Prep Time (min)')).toBeTruthy();
    expect(getByText('Cook Time (min)')).toBeTruthy();
  });

  it('calls updateField when name changes', () => {
    const { getByTestId } = render(
      <RecipeBasicFields state={defaultState} updateField={mockUpdateField} />,
    );

    fireEvent.changeText(getByTestId('input-Recipe Name'), 'New Recipe');
    expect(mockUpdateField).toHaveBeenCalledWith('name', 'New Recipe');
  });

  it('calls updateField when description changes', () => {
    const { getByTestId } = render(
      <RecipeBasicFields state={defaultState} updateField={mockUpdateField} />,
    );

    fireEvent.changeText(getByTestId('textarea-Description'), 'A description');
    expect(mockUpdateField).toHaveBeenCalledWith(
      'description',
      'A description',
    );
  });

  it('displays current state values', () => {
    const stateWithValues = {
      ...defaultState,
      name: 'Pasta',
      description: 'Italian dish',
      servings: '6',
    };

    const { getByTestId } = render(
      <RecipeBasicFields
        state={stateWithValues}
        updateField={mockUpdateField}
      />,
    );

    expect(getByTestId('input-Recipe Name').props.value).toBe('Pasta');
  });

  it('renders calories per serving counter', () => {
    const { getByText } = render(
      <RecipeBasicFields state={defaultState} updateField={mockUpdateField} />,
    );
    expect(getByText('Calories/Serving')).toBeTruthy();
  });
});
