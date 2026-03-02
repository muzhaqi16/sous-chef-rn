import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import CategorySelector from '../CategorySelector';

jest.mock('../../atoms/Chip', () => {
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, selected, onPress }: any) => (
      <Pressable onPress={onPress} testID={`chip-${label}`}>
        <Text>{label}</Text>
        {selected ? <Text>selected</Text> : null}
      </Pressable>
    ),
  };
});

describe('CategorySelector', () => {
  const categories = [
    { id: 'dairy', label: 'Dairy' },
    { id: 'grains', label: 'Grains' },
    { id: 'produce', label: 'Produce' },
  ];

  const defaultProps = {
    categories,
    selectedCategoryId: null,
    onSelectCategory: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the "Category" title', () => {
    render(<CategorySelector {...defaultProps} />);
    expect(screen.getByText('Category')).toBeTruthy();
  });

  it('renders all category chips', () => {
    render(<CategorySelector {...defaultProps} />);
    expect(screen.getByText('Dairy')).toBeTruthy();
    expect(screen.getByText('Grains')).toBeTruthy();
    expect(screen.getByText('Produce')).toBeTruthy();
  });

  it('marks the selected category', () => {
    render(
      <CategorySelector {...defaultProps} selectedCategoryId="grains" />,
    );
    expect(screen.getAllByText('selected')).toHaveLength(1);
  });

  it('calls onSelectCategory when a chip is pressed', () => {
    render(<CategorySelector {...defaultProps} />);
    fireEvent.press(screen.getByTestId('chip-Dairy'));
    expect(defaultProps.onSelectCategory).toHaveBeenCalledWith('dairy');
  });

  it('renders "See all" button when onSeeAll provided', () => {
    const onSeeAll = jest.fn();
    render(<CategorySelector {...defaultProps} onSeeAll={onSeeAll} />);
    expect(screen.getByText('See all')).toBeTruthy();
  });

  it('does not render "See all" button when onSeeAll not provided', () => {
    render(<CategorySelector {...defaultProps} />);
    expect(screen.queryByText('See all')).toBeNull();
  });

  it('calls onSeeAll when pressed', () => {
    const onSeeAll = jest.fn();
    render(<CategorySelector {...defaultProps} onSeeAll={onSeeAll} />);
    fireEvent.press(screen.getByText('See all'));
    expect(onSeeAll).toHaveBeenCalledTimes(1);
  });
});
