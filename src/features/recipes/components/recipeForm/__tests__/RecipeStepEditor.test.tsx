'use no memo';
import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { RecipeStepEditor } from '../RecipeStepEditor';

jest.mock('#components/atoms/BottomSheetFormScrollView', () => ({
  BottomSheetFormScrollView: ({ children }: { children?: React.ReactNode }) =>
    children,
}));
jest.mock('#components/atoms/FormTextArea', () => ({
  FormTextArea: (props: {
    value?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
  }) => {
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
jest.mock('#components/organisms/Header', () => ({
  Header: ({ title }: { title?: string }) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));
jest.mock('#/utils/generateId', () => ({ generateId: () => 'test-id' }));

describe('RecipeStepEditor', () => {
  const onSave = jest.fn();

  const renderEditor = () => {
    const ref = React.createRef<React.ComponentRef<typeof RecipeStepEditor>>();
    render(<RecipeStepEditor ref={ref} onSave={onSave} />);
    act(() => ref.current?.open());
  };

  it('renders without crashing', () => {
    renderEditor();
    expect(screen.toJSON()).toBeTruthy();
  });

  it('shows Add Step title by default', () => {
    renderEditor();
    expect(screen.getByText('Add Step')).toBeTruthy();
  });

  it('renders the instruction text area', () => {
    renderEditor();
    expect(screen.getByTestId('instruction-input')).toBeTruthy();
  });
});
