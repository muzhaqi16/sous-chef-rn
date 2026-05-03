'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RecipeStepEditor } from '../RecipeStepEditor';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#components/atoms/GlobalBottomSheetBackdrop', () => ({
  GlobalBottomSheetBackdrop: 'GlobalBottomSheetBackdrop',
}));
jest.mock('#components/atoms/BottomSheetFormScrollView', () => ({
  BottomSheetFormScrollView: ({ children }: any) => children,
}));
jest.mock('#components/molecules/FormTextArea', () => ({
  FormTextArea: (props: any) => {
    const { View, TextInput } = require('react-native');
    return (
      <View>
        <TextInput
          testID="instruction-input"
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
        />
      </View>
    );
  },
}));
jest.mock('#components/molecules/Header', () => ({
  Header: ({ title }: any) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));
jest.mock('#/utils/generateId', () => ({ generateId: () => 'test-id' }));

describe('RecipeStepEditor', () => {
  const onSave = jest.fn();

  it('renders without crashing', () => {
    const { toJSON } = render(<RecipeStepEditor onSave={onSave} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows Add Step title by default', () => {
    render(<RecipeStepEditor onSave={onSave} />);
    expect(screen.getByText('Add Step')).toBeTruthy();
  });

  it('renders the instruction text area', () => {
    render(<RecipeStepEditor onSave={onSave} />);
    expect(screen.getByTestId('instruction-input')).toBeTruthy();
  });
});
