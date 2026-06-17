import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { NotificationFilters } from '../NotificationFilters';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';

describe('NotificationFilters', () => {
  const defaultProps = {
    selectedCategory: null as NotificationCategory | null,
    onCategoryChange: jest.fn(),
  };

  // Mirrors the component's label formatting: 'HOME' → 'Home'.
  const displayLabel = (value: string): string =>
    value
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

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
      expect(screen.getByText(displayLabel(cat))).toBeTruthy();
    }
  });

  it('calls onCategoryChange with null when All is pressed', async () => {
    const user = userEvent.setup();
    render(<NotificationFilters {...defaultProps} />);
    await user.press(screen.getByText('All'));
    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith(null);
  });

  it('calls onCategoryChange with category when a category pill is pressed', async () => {
    const user = userEvent.setup();
    render(<NotificationFilters {...defaultProps} />);
    const firstCategory = Object.values(NotificationCategory)[0];
    await user.press(screen.getByText(displayLabel(firstCategory)));
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
