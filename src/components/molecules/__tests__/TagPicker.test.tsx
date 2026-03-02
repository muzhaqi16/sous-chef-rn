'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { TagPicker } from '../TagPicker';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        primary: '#007AFF',
        textPrimary: '#000',
        textSecondary: '#666',
      },
    },
  })),
}));

jest.mock('#utils/iconUtils', () => ({
  Icon: () => null,
}));

describe('TagPicker', () => {
  const defaultProps = {
    visible: true,
    tags: ['Dairy', 'Meat', 'Vegetables', 'Fruits', 'Grains', 'Snacks'],
    selectedTags: [] as string[],
    onSelect: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    render(<TagPicker {...defaultProps} />);
    expect(screen.getByText('Filter by Tags')).toBeTruthy();
  });

  it('renders tag list container', () => {
    const { toJSON } = render(<TagPicker {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows no tags selected text when none selected', () => {
    render(<TagPicker {...defaultProps} />);
    expect(screen.getByText('No tags selected')).toBeTruthy();
  });

  it('shows selected count when tags are selected', () => {
    render(<TagPicker {...defaultProps} selectedTags={['Dairy', 'Meat']} />);
    expect(screen.getByText('2 tags selected')).toBeTruthy();
  });

  it('shows singular tag selected text', () => {
    render(<TagPicker {...defaultProps} selectedTags={['Dairy']} />);
    expect(screen.getByText('1 tag selected')).toBeTruthy();
  });

  it('renders with fewer than 5 tags without search', () => {
    render(<TagPicker {...defaultProps} tags={['A', 'B']} />);
    expect(screen.queryByPlaceholderText('Search tags...')).toBeNull();
  });

  it('shows search input when more than 5 tags', () => {
    render(<TagPicker {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search tags...')).toBeTruthy();
  });

  it('shows No tags available when tags list is empty', () => {
    render(<TagPicker {...defaultProps} tags={[]} />);
    expect(screen.getByText('No tags available')).toBeTruthy();
  });
});
