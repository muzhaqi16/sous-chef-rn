'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MultiSelectChipSheet } from '../MultiSelectChipSheet';

jest.mock('#hooks/useStandardBottomSheet', () => ({
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
}));

jest.mock('#/components/atoms/BottomSheetHeader', () => ({
  BottomSheetHeader: ({ title, onCancel, onConfirm, confirmLabel }: any) => {
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(RN.View, { testID: 'header' },
      R.createElement(RN.Text, null, title),
      R.createElement(RN.Pressable, { onPress: onCancel, testID: 'cancel-btn' }, R.createElement(RN.Text, null, 'Cancel')),
      R.createElement(RN.Pressable, { onPress: onConfirm, testID: 'done-btn' }, R.createElement(RN.Text, null, confirmLabel)),
    );
  },
}));

jest.mock('#/components/atoms/AnimatedChip', () => ({
  AnimatedChip: ({ label, onPress }: any) => {
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(RN.Pressable, { onPress, testID: `chip-${label}` },
      R.createElement(RN.Text, null, label),
    );
  },
}));

jest.mock('#utils/iconUtils', () => ({
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
    selectedItems: [] as string[],
    onSelect: jest.fn(),
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
    render(<MultiSelectChipSheet {...defaultProps} selectedItems={['a', 'b']} />);
    expect(screen.getByText('2 selected')).toBeTruthy();
  });

  it('shows Clear all when items are selected', () => {
    render(<MultiSelectChipSheet {...defaultProps} selectedItems={['a']} />);
    expect(screen.getByText('Clear all')).toBeTruthy();
  });

  it('calls onSelect when chip is pressed', () => {
    render(<MultiSelectChipSheet {...defaultProps} />);
    fireEvent.press(screen.getByTestId('chip-Alpha'));
    expect(defaultProps.onSelect).toHaveBeenCalledWith(['a']);
  });

  it('shows loading state', () => {
    render(<MultiSelectChipSheet {...defaultProps} loading />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows empty state when no items match', () => {
    render(<MultiSelectChipSheet {...defaultProps} items={[]} />);
    expect(screen.getByText('No items available')).toBeTruthy();
  });
});
