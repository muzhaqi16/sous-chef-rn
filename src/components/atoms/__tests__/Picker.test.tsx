'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PickerSelect } from '../Picker';

jest.mock('@react-native-picker/picker', () => {
  const { View, Text } = require('react-native');
  const R = require('react');
  const Picker = ({ children, selectedValue, testID, ...rest }: any) =>
    R.createElement(View, { testID: testID || 'picker', ...rest },
      R.createElement(Text, null, selectedValue),
      children,
    );
  Picker.Item = ({ label, value }: any) =>
    R.createElement(Text, { testID: `picker-item-${value}` }, label);
  return { Picker };
});

describe('PickerSelect', () => {
  const items = [
    { label: 'Apple', value: 'apple', id: '1' },
    { label: 'Banana', value: 'banana', id: '2' },
    { label: 'Cherry', value: 'cherry', id: '3' },
  ];

  const defaultProps = {
    items,
    initialValue: 'apple',
    onValueChange: jest.fn(),
    style: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<PickerSelect {...defaultProps} />);
    expect(screen.getByTestId('picker')).toBeTruthy();
  });

  it('displays the selected value', () => {
    render(<PickerSelect {...defaultProps} initialValue="banana" />);
    expect(screen.getByText('banana')).toBeTruthy();
  });

  it('renders all picker items', () => {
    render(<PickerSelect {...defaultProps} />);
    expect(screen.getByText('Apple')).toBeTruthy();
    expect(screen.getByText('Banana')).toBeTruthy();
    expect(screen.getByText('Cherry')).toBeTruthy();
  });

  it('renders with empty items array', () => {
    render(<PickerSelect {...defaultProps} items={[]} />);
    expect(screen.getByTestId('picker')).toBeTruthy();
  });

  it('uses item.id as Picker.Item key', () => {
    render(<PickerSelect {...defaultProps} />);
    expect(screen.getByTestId('picker-item-1')).toBeTruthy();
    expect(screen.getByTestId('picker-item-2')).toBeTruthy();
    expect(screen.getByTestId('picker-item-3')).toBeTruthy();
  });
});
