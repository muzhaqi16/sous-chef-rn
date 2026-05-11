'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { FormSelect } from '../FormSelect';

jest.mock('#utils/iconUtils', () => ({
  Icon: 'Icon',
}));

describe('FormSelect', () => {
  const options = [
    { label: 'Option A', value: 'a' },
    { label: 'Option B', value: 'b' },
    { label: 'Option C', value: 'c' },
  ];

  const defaultProps = {
    label: 'Category',
    value: undefined as string | undefined,
    onValueChange: jest.fn(),
    options,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<FormSelect {...defaultProps} />);
    expect(screen.getByText('Category')).toBeTruthy();
  });

  it('shows placeholder when no value is selected', () => {
    render(<FormSelect {...defaultProps} />);
    expect(screen.getByText('Select an option')).toBeTruthy();
  });

  it('shows custom placeholder when provided', () => {
    render(<FormSelect {...defaultProps} placeholder="Pick one" />);
    expect(screen.getByText('Pick one')).toBeTruthy();
  });

  it('shows selected option label when value matches', () => {
    render(<FormSelect {...defaultProps} value="b" />);
    expect(screen.getByText('Option B')).toBeTruthy();
  });

  it('displays error message when error prop is provided', () => {
    render(<FormSelect {...defaultProps} error="Please select" />);
    expect(screen.getByText('Please select')).toBeTruthy();
  });

  it('opens modal and shows options when pressed', async () => {
    const user = userEvent.setup();
    render(<FormSelect {...defaultProps} />);
    await user.press(screen.getByText('Select an option'));
    // Modal should now show the label as title and the options
    expect(screen.getByText('Option A')).toBeTruthy();
    expect(screen.getByText('Option B')).toBeTruthy();
    expect(screen.getByText('Option C')).toBeTruthy();
    expect(screen.getByText('Close')).toBeTruthy();
  });
});
