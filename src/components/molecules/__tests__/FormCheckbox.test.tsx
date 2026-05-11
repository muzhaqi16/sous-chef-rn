'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { FormCheckbox } from '../FormCheckbox';

jest.mock('#utils/iconUtils', () => ({
  Icon: 'Icon',
}));

describe('FormCheckbox', () => {
  const defaultProps = {
    label: 'Accept terms',
    checked: false,
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<FormCheckbox {...defaultProps} />);
    expect(screen.getByText('Accept terms')).toBeTruthy();
  });

  it('displays the label text', () => {
    render(<FormCheckbox {...defaultProps} label="Enable notifications" />);
    expect(screen.getByText('Enable notifications')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const user = userEvent.setup();
    render(<FormCheckbox {...defaultProps} />);
    await user.press(screen.getByText('Accept terms'));
    expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
  });

  it('displays error message when error prop is provided', () => {
    render(<FormCheckbox {...defaultProps} error="Must accept" />);
    expect(screen.getByText('Must accept')).toBeTruthy();
  });

  it('does not display error when no error prop', () => {
    render(<FormCheckbox {...defaultProps} />);
    expect(screen.queryByText('Must accept')).toBeNull();
  });

  it('does not call onPress when disabled', async () => {
    const user = userEvent.setup();
    render(<FormCheckbox {...defaultProps} disabled />);
    await user.press(screen.getByText('Accept terms'));
    expect(defaultProps.onPress).not.toHaveBeenCalled();
  });
});
