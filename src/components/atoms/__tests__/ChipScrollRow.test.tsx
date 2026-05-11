import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { ChipScrollRow } from '../ChipScrollRow';

describe('ChipScrollRow', () => {
  const options = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'expired', label: 'Expired' },
  ];
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
  });

  it('renders all option labels', () => {
    render(
      <ChipScrollRow
        options={options}
        selected="all"
        onSelect={mockOnSelect}
      />,
    );
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Expired')).toBeTruthy();
  });

  it('calls onSelect with the correct key when pressed', async () => {
    const user = userEvent.setup();
    render(
      <ChipScrollRow
        options={options}
        selected="all"
        onSelect={mockOnSelect}
      />,
    );
    await user.press(screen.getByText('Active'));
    expect(mockOnSelect).toHaveBeenCalledWith('active');
  });

  it('calls onSelect with a different key', async () => {
    const user = userEvent.setup();
    render(
      <ChipScrollRow
        options={options}
        selected="all"
        onSelect={mockOnSelect}
      />,
    );
    await user.press(screen.getByText('Expired'));
    expect(mockOnSelect).toHaveBeenCalledWith('expired');
  });

  it('renders without crashing with empty options', () => {
    const { toJSON } = render(
      <ChipScrollRow options={[]} selected="" onSelect={mockOnSelect} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with single option', () => {
    render(
      <ChipScrollRow
        options={[{ key: 'only', label: 'Only Option' }]}
        selected="only"
        onSelect={mockOnSelect}
      />,
    );
    expect(screen.getByText('Only Option')).toBeTruthy();
  });
});
