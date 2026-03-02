import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { BaseSwitch } from '../BaseSwitch';

describe('BaseSwitch', () => {
  const mockOnValueChange = jest.fn();

  beforeEach(() => {
    mockOnValueChange.mockClear();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(
      <BaseSwitch value={false} onValueChange={mockOnValueChange} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with testID', () => {
    render(
      <BaseSwitch value={false} onValueChange={mockOnValueChange} testID="switch" />,
    );
    expect(screen.getByTestId('switch')).toBeTruthy();
  });

  it('reflects value prop as true', () => {
    render(
      <BaseSwitch value={true} onValueChange={mockOnValueChange} testID="switch" />,
    );
    const sw = screen.getByTestId('switch');
    expect(sw.props.value).toBe(true);
  });

  it('reflects value prop as false', () => {
    render(
      <BaseSwitch value={false} onValueChange={mockOnValueChange} testID="switch" />,
    );
    const sw = screen.getByTestId('switch');
    expect(sw.props.value).toBe(false);
  });

  it('calls onValueChange when toggled', () => {
    render(
      <BaseSwitch value={false} onValueChange={mockOnValueChange} testID="switch" />,
    );
    fireEvent(screen.getByTestId('switch'), 'valueChange', true);
    expect(mockOnValueChange).toHaveBeenCalledWith(true);
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <BaseSwitch value={false} onValueChange={mockOnValueChange} disabled testID="switch" />,
    );
    const sw = screen.getByTestId('switch');
    expect(sw.props.disabled).toBe(true);
  });

  it('is disabled when loading prop is true', () => {
    render(
      <BaseSwitch value={false} onValueChange={mockOnValueChange} loading testID="switch" />,
    );
    const sw = screen.getByTestId('switch');
    expect(sw.props.disabled).toBe(true);
  });
});
