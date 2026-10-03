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

  // Two choices can read the same (two empty stacks, "milk (0 mL)"); each is
  // still its own chip, and pressing one selects that one.
  it('keeps two chips with the same label apart by their keys', async () => {
    const user = userEvent.setup();
    render(
      <ChipScrollRow
        options={[
          { key: 'stack-a', label: 'milk (0 mL)' },
          { key: 'stack-b', label: 'milk (0 mL)' },
        ]}
        selected="stack-a"
        onSelect={mockOnSelect}
      />,
    );
    const chips = screen.getAllByText('milk (0 mL)');
    expect(chips).toHaveLength(2);
    await user.press(chips[1]!);
    expect(mockOnSelect).toHaveBeenCalledWith('stack-b');
  });
});
