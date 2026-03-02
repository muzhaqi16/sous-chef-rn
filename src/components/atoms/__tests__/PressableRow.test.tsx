import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { PressableRow } from '../PressableRow';

describe('PressableRow', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders title text', () => {
    render(<PressableRow title="Account Settings" onPress={mockOnPress} />);
    expect(screen.getByText('Account Settings')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(<PressableRow title="Name" subtitle="John Doe" onPress={mockOnPress} />);
    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('does not render subtitle when not provided', () => {
    render(<PressableRow title="Name" onPress={mockOnPress} />);
    expect(screen.queryByText('John Doe')).toBeNull();
  });

  it('calls onPress when pressed', () => {
    render(<PressableRow title="Settings" onPress={mockOnPress} testID="row" />);
    fireEvent.press(screen.getByTestId('row'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    render(<PressableRow title="Settings" onPress={mockOnPress} disabled testID="row" />);
    fireEvent.press(screen.getByTestId('row'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('renders rightElement when provided', () => {
    render(
      <PressableRow
        title="Notifications"
        onPress={mockOnPress}
        rightElement={<Text>ON</Text>}
      />,
    );
    expect(screen.getByText('ON')).toBeTruthy();
  });

  it('renders with testID', () => {
    render(<PressableRow title="Row" onPress={mockOnPress} testID="my-row" />);
    expect(screen.getByTestId('my-row')).toBeTruthy();
  });

  it('renders without onPress', () => {
    const { toJSON } = render(<PressableRow title="Static Row" testID="static-row" />);
    expect(toJSON()).toBeTruthy();
    expect(screen.getByText('Static Row')).toBeTruthy();
  });
});
