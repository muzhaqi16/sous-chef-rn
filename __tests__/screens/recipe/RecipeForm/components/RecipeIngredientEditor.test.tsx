'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { RecipeIngredientEditor } from '../../../../../src/features/recipes/screens/RecipeForm/components/RecipeIngredientEditor';

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

jest.mock(
  '#features/catalog/ui/autocomplete/ItemAutocompleteField',
  () => ({
    ItemAutocompleteField: (
      props: React.ComponentProps<
        typeof import('#features/catalog/ui/autocomplete/ItemAutocompleteField').ItemAutocompleteField
      >,
    ) => {
      const { Text } = require('react-native');
      return <Text>{props.label}</Text>;
    },
  }),
);
jest.mock(
  '#features/catalog/ui/autocomplete/UnitAutocompleteField',
  () => ({
    UnitAutocompleteField: (
      props: React.ComponentProps<
        typeof import('#features/catalog/ui/autocomplete/UnitAutocompleteField').UnitAutocompleteField
      >,
    ) => {
      const { Text } = require('react-native');
      return <Text>{props.label}</Text>;
    },
  }),
);
jest.mock('../../../../../src/components/molecules/FormInput', () => ({
  FormInput: (
    props: React.ComponentProps<
      typeof import('../../../../../src/components/molecules/FormInput').FormInput
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
    return <Text>{props.label}</Text>;
  },
}));
jest.mock('../../../../../src/components/molecules/FieldRow', () => ({
  FieldRow: (
    props: React.ComponentProps<
      typeof import('../../../../../src/components/molecules/FieldRow').FieldRow
    >,
  ) => {
    const { View } = require('react-native');
    return <View>{props.children}</View>;
  },
}));
jest.mock('../../../../../src/components/molecules/Header', () => ({
  Header: (
    props: React.ComponentProps<
      typeof import('../../../../../src/components/molecules/Header').Header
    >,
  ) => {
    const { Text } = require('react-native');
    return <Text>{props.title}</Text>;
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
    expect(getByText('Quantity')).toBeTruthy();
  });

  it('renders Optional switch label', () => {
    const { getByText } = render(<RecipeIngredientEditor onSave={onSave} />);
    expect(getByText('Optional')).toBeTruthy();
  });
});
