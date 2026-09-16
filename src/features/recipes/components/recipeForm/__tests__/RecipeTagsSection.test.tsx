'use no memo';

import React from 'react';
import { render, userEvent } from '@testing-library/react-native';
import { RecipeTagsSection } from '../RecipeTagsSection';
import type {
  Diet,
  HealthGoal,
  Intolerance,
} from '#/graphql/generated/schemaTypes';

jest.mock(
  '#components/organisms/MultiSelectChipSheet/MultiSelectChipSheet',
  () => ({
    MultiSelectChipSheet: ({
      visible,
      title,
      onSelect,
      onClose,
      onDone,
    }: {
      visible: boolean;
      title: string;
      onSelect: (items: string[]) => void;
      onClose: () => void;
      onDone: () => void;
    }) => {
      const { View, Text, Pressable } = require('react-native');
      if (!visible) return null;
      return (
        <View testID={`sheet-${title}`}>
          <Text>{title}</Text>
          <Pressable testID={`close-${title}`} onPress={onClose}>
            <Text>Close</Text>
          </Pressable>
          <Pressable testID={`done-${title}`} onPress={onDone}>
            <Text>Done</Text>
          </Pressable>
          <Pressable
            testID={`select-${title}`}
            onPress={() => onSelect(['VEGAN'])}
          >
            <Text>Select</Text>
          </Pressable>
        </View>
      );
    },
  }),
);

const mockOnDietsChange = jest.fn();
const mockOnHealthGoalsChange = jest.fn();
const mockOnIntolerancesChange = jest.fn();

const defaultProps = {
  diets: [] as Diet[],
  healthGoals: [] as HealthGoal[],
  intolerances: [] as Intolerance[],
  onDietsChange: mockOnDietsChange,
  onHealthGoalsChange: mockOnHealthGoalsChange,
  onIntolerancesChange: mockOnIntolerancesChange,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RecipeTagsSection', () => {
  it('renders section title', () => {
    const { getByText } = render(<RecipeTagsSection {...defaultProps} />);
    expect(getByText('Tags & Dietary Info')).toBeTruthy();
  });

  it('renders all three chip groups', () => {
    const { getByText } = render(<RecipeTagsSection {...defaultProps} />);
    expect(getByText('Diets')).toBeTruthy();
    expect(getByText('Health Goals')).toBeTruthy();
    expect(getByText('Intolerances')).toBeTruthy();
  });

  it('shows placeholder when no items selected', () => {
    const { getAllByText } = render(<RecipeTagsSection {...defaultProps} />);
    expect(getAllByText('Tap to select...')).toHaveLength(3);
  });

  it('shows chips when diets are selected', () => {
    const { getByText } = render(
      <RecipeTagsSection {...defaultProps} diets={['VEGAN' as Diet]} />,
    );
    expect(getByText('Vegan')).toBeTruthy();
  });

  it('opens diets sheet when diets group is pressed', async () => {
    const user = userEvent.setup();
    const { getByText, getByTestId, queryByTestId } = render(
      <RecipeTagsSection {...defaultProps} />,
    );

    expect(queryByTestId('sheet-Diets')).toBeNull();

    await user.press(getByText('Diets'));

    expect(getByTestId('sheet-Diets')).toBeTruthy();
  });

  it('opens health goals sheet when pressed', async () => {
    const user = userEvent.setup();
    const { getByText, getByTestId } = render(
      <RecipeTagsSection {...defaultProps} />,
    );

    await user.press(getByText('Health Goals'));
    expect(getByTestId('sheet-Health Goals')).toBeTruthy();
  });

  it('opens intolerances sheet when pressed', async () => {
    const user = userEvent.setup();
    const { getByText, getByTestId } = render(
      <RecipeTagsSection {...defaultProps} />,
    );

    await user.press(getByText('Intolerances'));
    expect(getByTestId('sheet-Intolerances')).toBeTruthy();
  });

  it('labels an enum value from its key', () => {
    const { getByText } = render(
      <RecipeTagsSection
        {...defaultProps}
        healthGoals={['HIGH_PROTEIN' as HealthGoal]}
      />,
    );
    expect(getByText('High Protein')).toBeTruthy();
  });

  it('renders multiple selected chips', () => {
    const { getByText } = render(
      <RecipeTagsSection
        {...defaultProps}
        diets={['VEGAN' as Diet, 'KETO' as Diet]}
      />,
    );
    expect(getByText('Vegan')).toBeTruthy();
    expect(getByText('Keto')).toBeTruthy();
  });
});
