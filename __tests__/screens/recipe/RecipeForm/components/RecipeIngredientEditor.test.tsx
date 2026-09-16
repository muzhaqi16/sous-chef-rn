'use no memo';

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { RecipeIngredientEditor } from '#features/recipes/components/recipeForm/RecipeIngredientEditor';

jest.mock('../../../../../src/apollo/links/tokenScheduler');
jest.mock('../../../../../src/apollo/links/refreshToken');

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
    return <Text>{props.label}</Text>;
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

  it('renders without crashing', () => {
    const { toJSON } = render(<RecipeIngredientEditor onSave={onSave} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows Add Ingredient title by default', () => {
    const { getByText } = render(<RecipeIngredientEditor onSave={onSave} />);
    expect(getByText('Add Ingredient')).toBeTruthy();
  });

  it('renders form fields', () => {
    const { getByText } = render(<RecipeIngredientEditor onSave={onSave} />);
    expect(getByText('Ingredient Name')).toBeTruthy();
    expect(getByText(/^Quantity:/)).toBeTruthy();
  });

  it('renders Optional switch label', () => {
    const { getByText } = render(<RecipeIngredientEditor onSave={onSave} />);
    expect(getByText('Optional')).toBeTruthy();
  });

  it('seeds a fractional quantity as a cooking fraction and saves it back', () => {
    const ref =
      React.createRef<React.ComponentRef<typeof RecipeIngredientEditor>>();
    const { getByText, getByTestId } = render(
      <RecipeIngredientEditor ref={ref} onSave={onSave} />,
    );

    act(() => {
      ref.current?.open({
        id: 'ing-1',
        name: 'Flour',
        quantity: 1.25,
        isOptional: false,
        sortOrder: 0,
      });
    });

    expect(getByText('Quantity:1 1/4')).toBeTruthy();
    fireEvent.press(getByTestId('header-right-0'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 1.25 }),
    );
  });

  it('seeds a quantity no fraction fits rounded to three decimals', () => {
    const ref =
      React.createRef<React.ComponentRef<typeof RecipeIngredientEditor>>();
    const { getByText } = render(
      <RecipeIngredientEditor ref={ref} onSave={onSave} />,
    );

    act(() => {
      ref.current?.open({
        id: 'ing-2',
        name: 'Milk',
        quantity: 177.4412,
        isOptional: false,
        sortOrder: 0,
      });
    });

    expect(getByText('Quantity:177.441')).toBeTruthy();
  });
});
