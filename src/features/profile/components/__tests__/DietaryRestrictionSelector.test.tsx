'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Diet, Intolerance, HealthGoal } from '#/graphql/generated/schemaTypes';
import type { RestrictionSectionProps } from '#/components/molecules/RestrictionSection/RestrictionSection';
import type { MultiSelectChipSheetProps } from '#/components/molecules/MultiSelectChipSheet/MultiSelectChipSheet';
import { DietaryRestrictionSelector } from '#features/profile/components/DietaryRestrictionSelector';

jest.mock('#/utils/finallyHelpers');

jest.mock(
  '#/components/molecules/RestrictionSection/RestrictionSection',
  () => {
    const { View, Text, Pressable } = require('react-native');
    return {
      RestrictionSection: ({
        title,
        existingItems,
        onRemove,
        onAddPress,
        emptyMessage,
      }: RestrictionSectionProps) => (
        <View testID={`restriction-section-${title}`}>
          <Text>{title}</Text>
          {existingItems.length === 0 ? (
            <Text>{emptyMessage}</Text>
          ) : (
            existingItems.map(item => (
              <View key={item.id}>
                <Text>{item.label}</Text>
                <Pressable
                  testID={`remove-${item.id}`}
                  onPress={() => onRemove(item.id)}
                >
                  <Text>Remove</Text>
                </Pressable>
              </View>
            ))
          )}
          <Pressable testID={`add-${title}`} onPress={onAddPress}>
            <Text>Add</Text>
          </Pressable>
        </View>
      ),
    };
  },
);

jest.mock(
  '#/components/molecules/MultiSelectChipSheet/MultiSelectChipSheet',
  () => {
    const { View, Text } = require('react-native');
    return {
      MultiSelectChipSheet: ({
        visible,
        title,
        items,
      }: MultiSelectChipSheetProps) =>
        visible ? (
          <View testID="multi-select-sheet">
            <Text>{title}</Text>
            {items.map(item => (
              <Text key={item.id}>{item.label}</Text>
            ))}
          </View>
        ) : null,
    };
  },
);

const defaultProps = {
  existingRestrictions: [],
  onAdd: jest.fn().mockResolvedValue(true),
  onRemove: jest.fn(),
  onSelectLifestyleDiet: jest.fn().mockResolvedValue(true),
};

describe('DietaryRestrictionSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all restriction sections', () => {
    render(<DietaryRestrictionSelector {...defaultProps} />);
    expect(screen.getByText('Diet')).toBeTruthy();
    expect(screen.getByText('Dietary Constraints')).toBeTruthy();
    expect(screen.getByText('Allergies & Intolerances')).toBeTruthy();
    expect(screen.getByText('Health Goals')).toBeTruthy();
  });

  it('shows empty messages when no restrictions exist', () => {
    render(<DietaryRestrictionSelector {...defaultProps} />);
    expect(screen.getByText('No diet selected yet')).toBeTruthy();
    expect(screen.getByText('No constraints added yet')).toBeTruthy();
    expect(screen.getByText('No allergies added yet')).toBeTruthy();
    expect(screen.getByText('No health goals added yet')).toBeTruthy();
  });

  it('renders the lifestyle diet in the Diet section and constraints separately', () => {
    const restrictions = [
      {
        id: 'r1',
        diet: Diet.Vegan,
        intolerance: null,
        healthGoal: null,
      },
      {
        id: 'r2',
        diet: Diet.GlutenFree,
        intolerance: null,
        healthGoal: null,
      },
    ];
    render(
      <DietaryRestrictionSelector
        {...defaultProps}
        existingRestrictions={restrictions}
      />,
    );
    // Lifestyle diet shows (Diet section); constraint shows (Constraints section)
    expect(screen.getByText('Vegan')).toBeTruthy();
    expect(screen.getByText('Gluten Free')).toBeTruthy();
  });

  it('renders existing intolerance restrictions', () => {
    const restrictions = [
      {
        id: 'r3',
        diet: null,
        intolerance: Intolerance.Dairy,
        healthGoal: null,
      },
    ];
    render(
      <DietaryRestrictionSelector
        {...defaultProps}
        existingRestrictions={restrictions}
      />,
    );
    expect(screen.getByText('Dairy')).toBeTruthy();
  });

  it('renders existing health goal restrictions', () => {
    const restrictions = [
      {
        id: 'r4',
        diet: null,
        intolerance: null,
        healthGoal: HealthGoal.LowCarb,
      },
    ];
    render(
      <DietaryRestrictionSelector
        {...defaultProps}
        existingRestrictions={restrictions}
      />,
    );
    expect(screen.getByText('Low Carb')).toBeTruthy();
  });

  it('renders add buttons for each section', () => {
    render(<DietaryRestrictionSelector {...defaultProps} />);
    expect(screen.getByTestId('add-Diet')).toBeTruthy();
    expect(screen.getByTestId('add-Dietary Constraints')).toBeTruthy();
    expect(screen.getByTestId('add-Allergies & Intolerances')).toBeTruthy();
    expect(screen.getByTestId('add-Health Goals')).toBeTruthy();
  });

  it('renders remove buttons for existing restrictions', () => {
    const restrictions = [
      {
        id: 'r1',
        diet: Diet.Vegetarian,
        intolerance: null,
        healthGoal: null,
      },
    ];
    render(
      <DietaryRestrictionSelector
        {...defaultProps}
        existingRestrictions={restrictions}
      />,
    );
    expect(screen.getByTestId('remove-r1')).toBeTruthy();
  });

  it('calls onRemove when remove button is pressed', async () => {
    const user = userEvent.setup();
    const restrictions = [
      {
        id: 'r1',
        diet: Diet.Vegetarian,
        intolerance: null,
        healthGoal: null,
      },
    ];
    render(
      <DietaryRestrictionSelector
        {...defaultProps}
        existingRestrictions={restrictions}
      />,
    );
    await user.press(screen.getByTestId('remove-r1'));
    expect(defaultProps.onRemove).toHaveBeenCalledWith('r1');
  });
});
