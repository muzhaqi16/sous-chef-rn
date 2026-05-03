import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SegmentedControl } from '../SegmentedControl';

describe('SegmentedControl', () => {
  const options = ['daily', 'weekly', 'monthly'];

  const defaultProps = {
    options,
    value: 'daily',
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all option labels', () => {
    render(<SegmentedControl {...defaultProps} />);
    expect(screen.getByText('daily')).toBeTruthy();
    expect(screen.getByText('weekly')).toBeTruthy();
    expect(screen.getByText('monthly')).toBeTruthy();
  });

  it('renders label when provided', () => {
    render(<SegmentedControl {...defaultProps} label="Frequency" />);
    expect(screen.getByText('Frequency')).toBeTruthy();
  });

  it('does not render label when not provided', () => {
    render(<SegmentedControl {...defaultProps} />);
    expect(screen.queryByText('Frequency')).toBeNull();
  });

  it('calls onChange with selected option when pressed', () => {
    render(<SegmentedControl {...defaultProps} />);
    fireEvent.press(screen.getByText('weekly'));
    expect(defaultProps.onChange).toHaveBeenCalledWith('weekly');
  });

  it('uses formatLabel to display option text', () => {
    const formatLabel = (val: string) =>
      val.charAt(0).toUpperCase() + val.slice(1);
    render(<SegmentedControl {...defaultProps} formatLabel={formatLabel} />);
    expect(screen.getByText('Daily')).toBeTruthy();
    expect(screen.getByText('Weekly')).toBeTruthy();
    expect(screen.getByText('Monthly')).toBeTruthy();
  });

  it('applies testID to container', () => {
    render(<SegmentedControl {...defaultProps} testID="seg-control" />);
    expect(screen.getByTestId('seg-control')).toBeTruthy();
  });

  it('renders required indicator when label and required are set', () => {
    render(<SegmentedControl {...defaultProps} label="Type" required />);
    // Label component renders "Type" with nested " *" Text child
    expect(screen.getByText(/Type/)).toBeTruthy();
    expect(screen.getByText(/ \*/)).toBeTruthy();
  });
});
