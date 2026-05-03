import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { NotificationFilters } from '../NotificationFilters';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';

describe('NotificationFilters', () => {
  const defaultProps = {
    selectedCategory: null as NotificationCategory | null,
    onCategoryChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders All filter', () => {
    render(<NotificationFilters {...defaultProps} />);
    expect(screen.getByText('All')).toBeTruthy();
  });

  it('renders filter pills for each notification category', () => {
    render(<NotificationFilters {...defaultProps} />);
    // Check a few known categories
    const categoryValues = Object.values(NotificationCategory);
    for (const cat of categoryValues) {
      // Categories have underscores replaced with spaces
      const displayName = cat.replace('_', ' ');
      expect(screen.getByText(displayName)).toBeTruthy();
    }
  });

  it('calls onCategoryChange with null when All is pressed', () => {
    render(<NotificationFilters {...defaultProps} />);
    fireEvent.press(screen.getByText('All'));
    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith(null);
  });

  it('calls onCategoryChange with category when a category pill is pressed', () => {
    render(<NotificationFilters {...defaultProps} />);
    const firstCategory = Object.values(NotificationCategory)[0];
    const displayName = firstCategory.replace('_', ' ');
    fireEvent.press(screen.getByText(displayName));
    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith(firstCategory);
  });

  it('renders with a selected category', () => {
    render(
      <NotificationFilters
        {...defaultProps}
        selectedCategory={NotificationCategory.Pantry}
      />,
    );
    // Should still render all filters
    expect(screen.getByText('All')).toBeTruthy();
  });
});
