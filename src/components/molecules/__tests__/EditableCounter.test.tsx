'use no memo';
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { EditableCounter } from '../EditableCounter';
import { getDeviceDecimalSeparator } from '#/utils/deviceLocale';

jest.mock('@react-native-vector-icons/ionicons', () => ({
  __esModule: true,
  default: 'Icon',
  Ionicons: 'Icon',
}));

jest.mock('#/utils/deviceLocale', () => ({
  ...jest.requireActual('#/utils/deviceLocale'),
  getDeviceDecimalSeparator: jest.fn(() => '.'),
}));

jest.mock('#components/atoms/Label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => {
    const { Text } = require('react-native');
    return require('react').createElement(Text, null, children);
  },
}));

describe('EditableCounter', () => {
  const defaultProps = {
    value: '5',
    onChangeText: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDeviceDecimalSeparator).mockReturnValue('.');
  });

  it('renders with the correct value', () => {
    render(<EditableCounter {...defaultProps} />);
    expect(screen.getByDisplayValue('5')).toBeTruthy();
  });

  it('renders label when provided', () => {
    render(<EditableCounter {...defaultProps} label="Quantity" />);
    expect(screen.getByText('Quantity')).toBeTruthy();
  });

  it('has adjustable accessibility role', () => {
    render(<EditableCounter {...defaultProps} />);
    expect(screen.getByRole('adjustable')).toBeTruthy();
  });

  it('calls onChangeText when increment is pressed', async () => {
    const user = userEvent.setup();
    render(<EditableCounter {...defaultProps} />);
    const incrementBtn = screen.getByLabelText('Increase quantity');
    await user.press(incrementBtn);
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('6');
  });

  it('calls onChangeText when decrement is pressed', async () => {
    const user = userEvent.setup();
    render(<EditableCounter {...defaultProps} />);
    const decrementBtn = screen.getByLabelText('Decrease quantity');
    await user.press(decrementBtn);
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('4');
  });

  it('does not go below min value on decrement', async () => {
    const user = userEvent.setup();
    render(<EditableCounter {...defaultProps} value="0" min={0} />);
    const decrementBtn = screen.getByLabelText('Decrease quantity');
    await user.press(decrementBtn);
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('0');
  });

  it('does not call callbacks when disabled', async () => {
    const user = userEvent.setup();
    render(<EditableCounter {...defaultProps} disabled />);
    const incrementBtn = screen.getByLabelText('Increase quantity');
    await user.press(incrementBtn);
    expect(defaultProps.onChangeText).not.toHaveBeenCalled();
  });

  describe('on a comma-decimal device', () => {
    beforeEach(() => {
      jest.mocked(getDeviceDecimalSeparator).mockReturnValue(',');
    });

    it('steps a comma-typed value and writes the comma back', async () => {
      const user = userEvent.setup();
      render(
        <EditableCounter
          {...defaultProps}
          value="0,2"
          step={0.1}
          notation="decimal"
        />,
      );
      await user.press(screen.getByLabelText('Increase quantity'));
      expect(defaultProps.onChangeText).toHaveBeenCalledWith('0,3');
    });

    it('writes a cooking fraction where one equals the stepped value', async () => {
      const user = userEvent.setup();
      render(<EditableCounter {...defaultProps} value="1,25" step={0.25} />);
      await user.press(screen.getByLabelText('Increase quantity'));
      expect(defaultProps.onChangeText).toHaveBeenCalledWith('1 1/2');
    });

    it('rounds a stepped value to three places', async () => {
      const user = userEvent.setup();
      render(<EditableCounter {...defaultProps} value="0,1" step={0.2} />);
      await user.press(screen.getByLabelText('Increase quantity'));
      expect(defaultProps.onChangeText).toHaveBeenCalledWith('0,3');
    });
  });

  it('updates value on direct text input', () => {
    render(<EditableCounter {...defaultProps} />);
    const input = screen.getByDisplayValue('5');
    fireEvent.changeText(input, '10');
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('10');
  });
});
