import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { DatePickerField } from '../DatePickerField';

// Mock the DateTimePicker since it's a native component
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) =>
      require('react').createElement(View, { testID: 'date-picker', ...props }),
  };
});

describe('DatePickerField', () => {
  const defaultProps = {
    value: null as Date | null,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders placeholder when no value', () => {
    render(<DatePickerField {...defaultProps} />);
    expect(screen.getByText('Select date')).toBeTruthy();
  });

  it('renders custom placeholder', () => {
    render(
      <DatePickerField {...defaultProps} placeholder="Choose a date" />,
    );
    expect(screen.getByText('Choose a date')).toBeTruthy();
  });

  it('renders formatted date when value is provided', () => {
    const date = new Date(2024, 5, 15); // June 15, 2024
    render(<DatePickerField {...defaultProps} value={date} />);
    // toLocaleDateString with short month format
    expect(screen.getByText(/Jun/)).toBeTruthy();
    expect(screen.getByText(/15/)).toBeTruthy();
  });

  it('renders label when provided', () => {
    render(<DatePickerField {...defaultProps} label="Expiry Date" />);
    expect(screen.getByText(/Expiry Date/)).toBeTruthy();
  });

  it('renders error message when provided', () => {
    render(<DatePickerField {...defaultProps} error="Date is required" />);
    expect(screen.getByText('Date is required')).toBeTruthy();
  });

  it('does not show picker initially', () => {
    render(<DatePickerField {...defaultProps} />);
    expect(screen.queryByTestId('date-picker')).toBeNull();
  });

  it('shows picker after pressing the field', () => {
    render(<DatePickerField {...defaultProps} />);
    fireEvent.press(screen.getByText('Select date'));
    expect(screen.getByTestId('date-picker')).toBeTruthy();
  });

  it('applies testID to container', () => {
    render(<DatePickerField {...defaultProps} testID="date-field" />);
    expect(screen.getByTestId('date-field')).toBeTruthy();
  });
});
