'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FormTextArea } from '../FormTextArea';

jest.mock('#context/BottomSheetInputContext', () => ({
  useIsBottomSheetInput: jest.fn(() => false),
}));

describe('FormTextArea', () => {
  const defaultProps = {
    label: 'Description',
    value: '',
    onChangeText: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<FormTextArea {...defaultProps} />);
    expect(screen.getByText('Description')).toBeTruthy();
  });

  it('displays the label', () => {
    render(<FormTextArea {...defaultProps} label="Notes" />);
    expect(screen.getByText('Notes')).toBeTruthy();
  });

  it('displays error message when error prop is provided', () => {
    render(<FormTextArea {...defaultProps} error="Too long" />);
    expect(screen.getByText('Too long')).toBeTruthy();
  });

  it('does not display error when no error prop', () => {
    render(<FormTextArea {...defaultProps} />);
    expect(screen.queryByText('Too long')).toBeNull();
  });

  it('shows required indicator when required is true', () => {
    render(<FormTextArea {...defaultProps} required />);
    expect(screen.getByText(' *')).toBeTruthy();
  });

  it('calls onChangeText when text is entered', () => {
    render(<FormTextArea {...defaultProps} testID="desc-input" />);
    const input = screen.getByTestId('desc-input');
    fireEvent.changeText(input, 'Hello');
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('Hello');
  });
});
