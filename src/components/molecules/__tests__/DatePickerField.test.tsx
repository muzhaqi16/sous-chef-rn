import React from 'react';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { kitTestIDs } from '#components/testIDs';
import { motion } from '#/theme/foundations/motion';
import { DatePickerField } from '../DatePickerField';

const FIELD = 'date-field';
const CALENDAR = kitTestIDs.datePickerCalendar(FIELD);

describe('DatePickerField', () => {
  const defaultProps = {
    value: null as Date | null,
    onChange: jest.fn(),
    testID: FIELD,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders placeholder when no value', () => {
    render(<DatePickerField {...defaultProps} />);
    expect(screen.getByText('Select date')).toBeTruthy();
  });

  it('renders custom placeholder', () => {
    render(<DatePickerField {...defaultProps} placeholder="Choose a date" />);
    expect(screen.getByText('Choose a date')).toBeTruthy();
  });

  it('renders formatted date when value is provided', () => {
    const date = new Date(2024, 5, 15); // June 15, 2024
    render(<DatePickerField {...defaultProps} value={date} />);
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

  it('opens the calendar on the set day, and picking a day sets it and closes it', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onChange = jest.fn();
    render(
      <DatePickerField
        {...defaultProps}
        value={new Date(2024, 5, 15)}
        onChange={onChange}
      />,
    );
    expect(screen.queryByTestId(CALENDAR)).toBeNull();

    await user.press(screen.getByText(/Jun/));
    expect(screen.getByTestId(CALENDAR)).toBeTruthy();

    await user.press(screen.getByTestId(`${CALENDAR}.day_2024-06-20`));
    expect(onChange).toHaveBeenCalledWith(new Date(2024, 5, 20));
    act(() => {
      jest.advanceTimersByTime(motion.timing.STANDARD);
    });
    expect(screen.queryByTestId(CALENDAR)).toBeNull();
    jest.useRealTimers();
  });

  it('clears a set date only when clearable', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { rerender } = render(
      <DatePickerField
        {...defaultProps}
        label="Expiry Date"
        value={new Date(2024, 5, 15)}
        onChange={onChange}
      />,
    );
    expect(screen.queryByLabelText(/Clear/)).toBeNull();

    rerender(
      <DatePickerField
        {...defaultProps}
        label="Expiry Date"
        value={new Date(2024, 5, 15)}
        onChange={onChange}
        clearable
      />,
    );
    await user.press(screen.getByLabelText(/Clear/));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('applies testID to container', () => {
    render(<DatePickerField {...defaultProps} />);
    expect(screen.getByTestId(FIELD)).toBeTruthy();
  });
});
