import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title text', () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText('No items found')).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="Try adding some items" />);
    expect(screen.getByText('Try adding some items')).toBeTruthy();
  });

  it('renders hint when provided', () => {
    render(<EmptyState title="Empty" hint="Tip: tap the plus button" />);
    expect(screen.getByText('Tip: tap the plus button')).toBeTruthy();
  });

  it('renders emoji icon', () => {
    render(<EmptyState title="Empty" icon="📦" />);
    expect(screen.getByText('📦')).toBeTruthy();
  });

  it('renders action button and handles press', async () => {
    const user = userEvent.setup();
    const mockPress = jest.fn();
    render(
      <EmptyState
        title="Empty"
        action={{ label: 'Add Item', onPress: mockPress }}
      />,
    );
    expect(screen.getByText('Add Item')).toBeTruthy();
    await user.press(screen.getByText('Add Item'));
    expect(mockPress).toHaveBeenCalledTimes(1);
  });

  it('renders secondary action button', () => {
    const mockPress = jest.fn();
    render(
      <EmptyState
        title="Empty"
        secondaryAction={{ label: 'Go Back', onPress: mockPress }}
      />,
    );
    expect(screen.getByText('Go Back')).toBeTruthy();
  });

  it('sets accessibilityRole to summary', () => {
    render(<EmptyState title="Nothing here" testID="empty" />);
    const container = screen.getByTestId('empty');
    expect(container.props.accessibilityRole).toBe('summary');
  });

  it('renders with testID', () => {
    render(<EmptyState title="Empty" testID="empty-state" />);
    expect(screen.getByTestId('empty-state')).toBeTruthy();
  });
});
