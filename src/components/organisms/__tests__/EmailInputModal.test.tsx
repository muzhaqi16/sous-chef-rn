'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EmailInputModal } from '../EmailInputModal';

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeWithLoadingState: (fn: () => Promise<void>, setLoading: (v: boolean) => void, onError: (e: unknown) => void) => {
    setLoading(true);
    fn().then(() => setLoading(false)).catch((e: unknown) => { setLoading(false); onError(e); });
  },
}));

describe('EmailInputModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onSubmit: jest.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the default title', () => {
    render(<EmailInputModal {...defaultProps} />);
    expect(screen.getByText('Invite Member')).toBeTruthy();
  });

  it('renders custom title', () => {
    render(<EmailInputModal {...defaultProps} title="Add Collaborator" />);
    expect(screen.getByText('Add Collaborator')).toBeTruthy();
  });

  it('renders placeholder text', () => {
    render(<EmailInputModal {...defaultProps} />);
    expect(screen.getByPlaceholderText('Enter email address')).toBeTruthy();
  });

  it('renders default buttons', () => {
    render(<EmailInputModal {...defaultProps} />);
    expect(screen.getByText('Send Invite')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls onClose when cancel is pressed', () => {
    render(<EmailInputModal {...defaultProps} />);
    fireEvent.press(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows error for empty email', () => {
    render(<EmailInputModal {...defaultProps} />);
    fireEvent.press(screen.getByText('Send Invite'));
    expect(screen.getByText('Please enter an email address')).toBeTruthy();
  });

  it('shows error for invalid email', () => {
    render(<EmailInputModal {...defaultProps} />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'notanemail');
    fireEvent.press(screen.getByText('Send Invite'));
    expect(screen.getByText('Please enter a valid email address')).toBeTruthy();
  });

  it('clears error when user types', () => {
    render(<EmailInputModal {...defaultProps} />);
    fireEvent.press(screen.getByText('Send Invite'));
    expect(screen.getByText('Please enter an email address')).toBeTruthy();
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'a');
    expect(screen.queryByText('Please enter an email address')).toBeNull();
  });
});
