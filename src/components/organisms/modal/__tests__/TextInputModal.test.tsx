'use no memo';
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { TextInputModal } from '../TextInputModal';

jest.mock('#/utils/finallyHelpers');

describe('TextInputModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onSubmit: jest.fn(() => Promise.resolve()),
    title: 'Enter Name',
    placeholder: 'Type your name',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    render(<TextInputModal {...defaultProps} />);
    expect(screen.getByText('Enter Name')).toBeTruthy();
  });

  it('renders placeholder text', () => {
    render(<TextInputModal {...defaultProps} />);
    expect(screen.getByPlaceholderText('Type your name')).toBeTruthy();
  });

  it('renders default submit and cancel buttons', () => {
    render(<TextInputModal {...defaultProps} />);
    expect(screen.getByText('Submit')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('renders custom button labels', () => {
    render(
      <TextInputModal
        {...defaultProps}
        submitText="Save"
        cancelText="Dismiss"
      />,
    );
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByText('Dismiss')).toBeTruthy();
  });

  it('calls onClose when cancel button is pressed', async () => {
    const user = userEvent.setup();
    render(<TextInputModal {...defaultProps} />);
    await user.press(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows required validation error for empty input', async () => {
    const user = userEvent.setup();
    render(<TextInputModal {...defaultProps} />);
    const input = screen.getByPlaceholderText('Type your name');
    fireEvent.changeText(input, '');
    await user.press(screen.getByText('Submit'));
    expect(screen.getByText('This field is required')).toBeTruthy();
  });

  it('clears error when user types', async () => {
    const user = userEvent.setup();
    render(<TextInputModal {...defaultProps} />);
    await user.press(screen.getByText('Submit'));
    expect(screen.getByText('This field is required')).toBeTruthy();
    const input = screen.getByPlaceholderText('Type your name');
    fireEvent.changeText(input, 'Hello');
    expect(screen.queryByText('This field is required')).toBeNull();
  });

  it('does not render when visible is false', () => {
    render(<TextInputModal {...defaultProps} visible={false} />);
    expect(screen.queryByText('Enter Name')).toBeNull();
  });
});
