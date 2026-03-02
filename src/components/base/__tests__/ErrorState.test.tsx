import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
  it('renders title text', () => {
    render(<ErrorState title="Something went wrong" message="An error occurred" />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('renders message text', () => {
    render(<ErrorState title="Error" message="Please try again later" />);
    expect(screen.getByText('Please try again later')).toBeTruthy();
  });

  it('renders details when provided', () => {
    render(<ErrorState title="Error" message="Failed" details="Error code: 500" />);
    expect(screen.getByText('Error code: 500')).toBeTruthy();
  });

  it('renders default emoji icon', () => {
    render(<ErrorState title="Error" message="Something broke" />);
    // Default icon is the warning emoji
    expect(screen.getByText('⚠️')).toBeTruthy();
  });

  it('renders retry button and handles press', () => {
    const mockRetry = jest.fn();
    render(<ErrorState title="Error" message="Failed" onRetry={mockRetry} />);
    expect(screen.getByText('Try Again')).toBeTruthy();
    fireEvent.press(screen.getByText('Try Again'));
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('renders custom retry label', () => {
    const mockRetry = jest.fn();
    render(
      <ErrorState title="Error" message="Failed" onRetry={mockRetry} retryLabel="Reload" />,
    );
    expect(screen.getByText('Reload')).toBeTruthy();
  });

  it('renders secondary action', () => {
    const mockPress = jest.fn();
    render(
      <ErrorState
        title="Error"
        message="Failed"
        secondaryAction={{ label: 'Go Home', onPress: mockPress }}
      />,
    );
    expect(screen.getByText('Go Home')).toBeTruthy();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorState title="Error" message="Failed" />);
    expect(screen.queryByText('Try Again')).toBeNull();
  });
});
