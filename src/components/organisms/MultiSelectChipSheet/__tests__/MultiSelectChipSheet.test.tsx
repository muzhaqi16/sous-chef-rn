'use no memo';
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { MultiSelectChipSheet } from '../MultiSelectChipSheet';

jest.mock('#hooks/ui/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
        primary: '#007AFF',
      },
    },
  })),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('#components/molecules/Chip', () => ({
  Chip: ({ label, onPress }: { label: string; onPress: () => void }) => {
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(
      RN.Pressable,
      { onPress, testID: `chip-${label}` },
      R.createElement(RN.Text, null, label),
    );
  },
}));

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
}));

describe('MultiSelectChipSheet', () => {
  const items = [
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
    { id: 'c', label: 'Charlie' },
  ];

  const defaultProps = {
    visible: true,
    title: 'Select Items',
    items,
    initialSelected: [] as string[],
    onClose: jest.fn(),
    onDone: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    render(<MultiSelectChipSheet {...defaultProps} />);
    expect(screen.getByText('Select Items')).toBeTruthy();
  });

  it('renders all chip items', () => {
    render(<MultiSelectChipSheet {...defaultProps} />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Charlie')).toBeTruthy();
  });

  it('shows no items selected text', () => {
    render(<MultiSelectChipSheet {...defaultProps} />);
    expect(screen.getByText('No items selected')).toBeTruthy();
  });

  it('shows selected count', () => {
    render(
      <MultiSelectChipSheet {...defaultProps} initialSelected={['a', 'b']} />,
    );
    expect(screen.getByText('2 items selected')).toBeTruthy();
  });

  it('shows Clear all when items are selected', () => {
    render(<MultiSelectChipSheet {...defaultProps} initialSelected={['a']} />);
    expect(screen.getByText('Clear all')).toBeTruthy();
  });

  // The picks stay the sheet's until Done hands them over.
  it('hands Done the picks made', async () => {
    const user = userEvent.setup();
    render(<MultiSelectChipSheet {...defaultProps} initialSelected={['b']} />);
    await user.press(screen.getByTestId('chip-Alpha'));
    expect(defaultProps.onDone).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Done' }));

    expect(defaultProps.onDone).toHaveBeenCalledWith(['b', 'a']);
  });

  it("opens again on what it is given, not on the last opening's picks", async () => {
    const user = userEvent.setup();
    const view = render(<MultiSelectChipSheet {...defaultProps} />);
    await user.press(screen.getByTestId('chip-Alpha'));
    expect(screen.getByText('1 item selected')).toBeTruthy();

    view.rerender(<MultiSelectChipSheet {...defaultProps} visible={false} />);
    view.rerender(<MultiSelectChipSheet {...defaultProps} />);

    expect(screen.getByText('No items selected')).toBeTruthy();
  });

  it('picks by its own rule where it is given one', async () => {
    const user = userEvent.setup();
    render(
      <MultiSelectChipSheet
        {...defaultProps}
        initialSelected={['b']}
        toggle={(_selected, id) => [id]}
      />,
    );
    await user.press(screen.getByTestId('chip-Alpha'));
    await user.press(screen.getByRole('button', { name: 'Done' }));

    expect(defaultProps.onDone).toHaveBeenCalledWith(['a']);
  });

  it('shows loading state', () => {
    render(<MultiSelectChipSheet {...defaultProps} loading />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows empty state when no items match', () => {
    render(<MultiSelectChipSheet {...defaultProps} items={[]} />);
    expect(screen.getByText('No items available')).toBeTruthy();
  });

  describe('its search', () => {
    // Nine items, so the sheet offers a search.
    const many = [
      'Alpha',
      'Beta',
      'Charlie',
      'Delta',
      'Echo',
      'Foxtrot',
      'Golf',
      'Hotel',
      'India',
    ].map(label => ({ id: label, label }));

    it('clears the field and its filter with the ✕', () => {
      render(<MultiSelectChipSheet {...defaultProps} items={many} />);
      fireEvent.changeText(screen.getByPlaceholderText('Search...'), 'alp');
      expect(screen.queryByText('Beta')).toBeNull();

      fireEvent.press(screen.getByLabelText('Clear input'));

      expect(screen.getByText('Beta')).toBeOnTheScreen();
    });

    it('opens again with no search', () => {
      const view = render(
        <MultiSelectChipSheet {...defaultProps} items={many} />,
      );
      fireEvent.changeText(screen.getByPlaceholderText('Search...'), 'alp');

      view.rerender(
        <MultiSelectChipSheet {...defaultProps} items={many} visible={false} />,
      );
      view.rerender(<MultiSelectChipSheet {...defaultProps} items={many} />);

      expect(screen.getByText('Beta')).toBeOnTheScreen();
    });
  });
});
