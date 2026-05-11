'use no memo';
import React from 'react';
import { fireEvent, render, screen} from '@testing-library/react-native';
import { FormInput } from '../FormInput';

jest.mock('#context/BottomSheetInputContext', () => ({
  useIsBottomSheetInput: jest.fn(() => false),
}));

describe('FormInput', () => {
  const defaultProps = {
    label: 'Name',
    value: '',
    onChangeText: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<FormInput {...defaultProps} />);
    expect(screen.getByText('Name')).toBeTruthy();
  });

  it('displays the label', () => {
    render(<FormInput {...defaultProps} label="Email" />);
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('displays error message when error prop is provided', () => {
    render(<FormInput {...defaultProps} error="Required field" />);
    expect(screen.getByText('Required field')).toBeTruthy();
  });

  it('does not display error when no error prop', () => {
    render(<FormInput {...defaultProps} />);
    expect(screen.queryByText('Required field')).toBeNull();
  });

  it('shows required indicator when required is true', () => {
    render(<FormInput {...defaultProps} required />);
    expect(screen.getByText(' *')).toBeTruthy();
  });

  it('calls onChangeText when text is entered', () => {
    render(<FormInput {...defaultProps} testID="name-input" />);
    const input = screen.getByTestId('name-input');
    fireEvent.changeText(input, 'John');
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('John');
  });
});
