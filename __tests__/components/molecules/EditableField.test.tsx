'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { EditableField } from '../../../src/components/molecules/EditableField';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('../../../src/components/molecules/FormInput', () => ({
  FormInput: (props: {
    value?: string;
    onChangeText?: (text: string) => void;
  }) => {
    const { TextInput } = require('react-native');
    return (
      <TextInput
        testID="form-input"
        value={props.value}
        onChangeText={props.onChangeText}
      />
    );
  },
}));

describe('EditableField', () => {
  const defaultProps = {
    label: 'Display Name',
    value: 'John Doe',
    onSave: jest.fn(),
  };

  it('renders label and value in display mode', () => {
    const { getByText } = render(<EditableField {...defaultProps} />);
    expect(getByText('Display Name')).toBeTruthy();
    expect(getByText('John Doe')).toBeTruthy();
  });

  it('is defined as a component', () => {
    expect(EditableField).toBeDefined();
  });

  it('renders without crashing with all props', () => {
    const { toJSON } = render(
      <EditableField
        {...defaultProps}
        placeholder="Enter name"
        validation={(v) => (v.length < 2 ? 'Too short' : null)}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom placeholder', () => {
    const { toJSON } = render(
      <EditableField {...defaultProps} placeholder="Enter name" />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
