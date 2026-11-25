'use no memo';

import React from 'react';
import { fireEvent, render, userEvent } from '@testing-library/react-native';
import { RecipeIngredientEditor } from '#features/recipes/components/recipeForm/RecipeIngredientEditor';

// The real one builds a gorhom scrollable at module load, which needs
// SCROLLABLE_TYPE from the (mocked) library. Stand it in with a plain View —
// the same shape MarkCookedModal's suite uses.
jest.mock(
  '../../../../../src/components/atoms/BottomSheetFormScrollView',
  () => {
    const RN = require('react-native');
    const R = require('react');
    return {
      BottomSheetFormScrollView: (props: { children?: React.ReactNode }) =>
        R.createElement(RN.View, props),
    };
  },
);

jest.mock('#features/catalog/ui/autocomplete/ItemAutocompleteField', () => ({
  ItemAutocompleteField: (
    props: React.ComponentProps<
      typeof import('#features/catalog/ui/autocomplete/ItemAutocompleteField').ItemAutocompleteField
    >,
  ) => {
    const { Text } = require('react-native');
    return (
      <>
        <Text>{props.label}</Text>
        {props.error ? <Text>{props.error}</Text> : null}
      </>
    );
  },
}));
jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () => ({
  UnitAutocompleteField: (
    props: React.ComponentProps<
      typeof import('#features/catalog/ui/autocomplete/UnitAutocompleteField').UnitAutocompleteField
    >,
  ) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));
jest.mock('../../../../../src/components/atoms/FormInput', () => ({
  FormInput: (
    props: React.ComponentProps<
      typeof import('../../../../../src/components/atoms/FormInput').FormInput
    >,
  ) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));
jest.mock('../../../../../src/components/molecules/EditableCounter', () => ({
  EditableCounter: (
    props: React.ComponentProps<
      typeof import('../../../../../src/components/molecules/EditableCounter').EditableCounter
    >,
  ) => {
    const { Text } = require('react-native');
    return <Text>{`${props.label}:${props.value}`}</Text>;
  },
}));
jest.mock('../../../../../src/components/atoms/FieldRow', () => ({
  FieldRow: (
    props: React.ComponentProps<
      typeof import('../../../../../src/components/atoms/FieldRow').FieldRow
    >,
  ) => {
    const { View } = require('react-native');
    return <View>{props.children}</View>;
  },
}));
jest.mock('../../../../../src/components/organisms/Header', () => ({
  Header: (
    props: React.ComponentProps<
      typeof import('../../../../../src/components/organisms/Header').Header
    >,
  ) => {
    const { Pressable, Text, View } = require('react-native');
    return (
      <View>
        <Text>{props.title}</Text>
        {(props.rightActions ?? []).map((action, index) => (
          <Pressable
            key={index}
            testID={`header-right-${index}`}
            onPress={action.onPress}
          />
        ))}
      </View>
    );
  },
}));

describe('RecipeIngredientEditor', () => {
  const onSave = jest.fn();

  beforeEach(() => {
    onSave.mockClear();
  });

  const renderEditor = () => {
    return render(
      <RecipeIngredientEditor visible onDismiss={jest.fn()} onSave={onSave} />,
    );
  };
  it('renders without crashing', () => {
    const { toJSON } = renderEditor();
    expect(toJSON()).toBeTruthy();
  });
  it('shows Add Ingredient title by default', () => {
    const { getByText } = renderEditor();
    expect(getByText('Add Ingredient')).toBeTruthy();
  });
  it('renders form fields', () => {
    const { getByText } = renderEditor();
    expect(getByText('Ingredient Name')).toBeTruthy();
    expect(getByText(/^Quantity:/)).toBeTruthy();
  });
  it('asks for a name on the field when saved without one', async () => {
    const { getByTestId, getByText } = renderEditor();
    await userEvent.setup().press(getByTestId('header-right-0'));
    expect(getByText('Please enter an item name')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
  it('renders Optional switch label', () => {
    const { getByText } = renderEditor();
    expect(getByText('Optional')).toBeTruthy();
  });
  it('seeds a fractional quantity as a cooking fraction and saves it back', async () => {
    const { getByText, getByTestId } = render(
      <RecipeIngredientEditor
        visible
        ingredient={{
          id: 'ing-1',
          name: 'Flour',
          quantity: 1.25,
          isOptional: false,
          sortOrder: 0,
        }}
        onDismiss={jest.fn()}
        onSave={onSave}
      />,
    );

    expect(getByText('Quantity:1 1/4')).toBeTruthy();
    await userEvent.setup().press(getByTestId('header-right-0'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 1.25 }),
    );
  });

  it('seeds a quantity no fraction fits rounded to three decimals', () => {
    const { getByText } = render(
      <RecipeIngredientEditor
        visible
        ingredient={{
          id: 'ing-2',
          name: 'Milk',
          quantity: 177.4412,
          isOptional: false,
          sortOrder: 0,
        }}
        onDismiss={jest.fn()}
        onSave={onSave}
      />,
    );

    expect(getByText('Quantity:177.441')).toBeTruthy();
  });

  // A captured line the server could not match offers what it proposed.
  it('links an unmatched captured line to an item its capture proposed', async () => {
    const save = jest.fn();
    const candidatesFor = (line: string | null | undefined) =>
      line === '2 scallions'
        ? [
            { itemId: 'item-green-onion', name: 'Green onion' },
            { itemId: 'item-onion', name: 'Onion' },
          ]
        : [];
    const { getByText, getByTestId, getByRole } = render(
      <RecipeIngredientEditor
        visible
        ingredient={{
          id: 'ing-1',
          name: 'scallions',
          quantity: 2,
          originalText: '2 scallions',
          itemId: null,
          isOptional: false,
          sortOrder: 0,
        }}
        onDismiss={jest.fn()}
        onSave={save}
        candidatesFor={candidatesFor}
      />,
    );
    fireEvent.press(getByText('Green onion'));

    expect(getByRole('button', { name: 'Green onion' })).toBeSelected();
    expect(getByRole('button', { name: 'Onion' })).not.toBeSelected();
    await userEvent.setup().press(getByTestId('header-right-0'));

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'scallions',
        itemId: 'item-green-onion',
        originalText: '2 scallions',
      }),
    );
  });
});
