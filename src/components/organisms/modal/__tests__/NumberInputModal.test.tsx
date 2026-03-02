'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { NumberInputModal } from '../NumberInputModal';

jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    card: {},
    h3: {},
    body: {},
    bodySecondary: {},
    input: {},
    button: {},
    buttonPrimary: {},
    buttonText: {},
    buttonTextPrimary: {},
  },
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeWithLoadingState: (fn: () => Promise<void>, setLoading: (v: boolean) => void, onError: (e: unknown) => void) => {
    setLoading(true);
    fn().then(() => setLoading(false)).catch((e: unknown) => { setLoading(false); onError(e); });
  },
}));

describe('NumberInputModal', () => {
  const defaultProps = {
    visible: true,
    title: 'Meals Per Day',
    value: 3,
    onSave: jest.fn(() => Promise.resolve(true)),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal with title', () => {
    render(<NumberInputModal {...defaultProps} />);
    expect(screen.getByText('Meals Per Day')).toBeTruthy();
  });

  it('does not render when visible is false', () => {
    render(<NumberInputModal {...defaultProps} visible={false} />);
    expect(screen.queryByText('Meals Per Day')).toBeNull();
  });

  it('displays the current value in the input', () => {
    render(<NumberInputModal {...defaultProps} />);
    const input = screen.getByDisplayValue('3');
    expect(input).toBeTruthy();
  });

  it('renders custom save and cancel button labels', () => {
    render(<NumberInputModal {...defaultProps} saveButtonLabel="Update" cancelButtonLabel="Dismiss" />);
    expect(screen.getByText('Update')).toBeTruthy();
    expect(screen.getByText('Dismiss')).toBeTruthy();
  });

  it('renders label and helper text when provided', () => {
    render(<NumberInputModal {...defaultProps} label="Max prep time" helperText="How much time" />);
    expect(screen.getByText(/Max prep time/)).toBeTruthy();
    expect(screen.getByText('How much time')).toBeTruthy();
  });

  it('calls onCancel when cancel button is pressed', () => {
    render(<NumberInputModal {...defaultProps} />);
    fireEvent.press(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('shows validation error for empty required field', async () => {
    render(<NumberInputModal {...defaultProps} value={null} required />);
    const input = screen.getByPlaceholderText('Enter meals per day');
    fireEvent.changeText(input, '');
    fireEvent.press(screen.getByText('Save'));
    expect(screen.getByText('This field is required')).toBeTruthy();
  });

  it('shows min validation error', () => {
    render(<NumberInputModal {...defaultProps} min={1} max={6} />);
    const input = screen.getByDisplayValue('3');
    fireEvent.changeText(input, '0');
    fireEvent.press(screen.getByText('Save'));
    expect(screen.getByText('Value must be at least 1')).toBeTruthy();
  });
});
