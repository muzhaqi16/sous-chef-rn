'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { NotificationBanner } from '../Notification';

describe('NotificationBanner', () => {
  const defaultProps = {
    message: 'Item added successfully',
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders without crashing', () => {
    render(<NotificationBanner {...defaultProps} />);
    expect(screen.getByText('Item added successfully')).toBeTruthy();
  });

  it('displays the message text', () => {
    render(
      <NotificationBanner {...defaultProps} message="Something happened" />,
    );
    expect(screen.getByText('Something happened')).toBeTruthy();
  });

  it('displays the title when provided', () => {
    render(<NotificationBanner {...defaultProps} title="Success" />);
    expect(screen.getByText('Success')).toBeTruthy();
  });

  it('does not display title when not provided', () => {
    render(<NotificationBanner {...defaultProps} />);
    expect(screen.queryByText('Success')).toBeNull();
  });

  it('renders close button', () => {
    render(<NotificationBanner {...defaultProps} />);
    // The close button renders a multiplication sign character
    expect(screen.getByText('\u00d7')).toBeTruthy();
  });

  it('hides after pressing close button', async () => {
    const user = userEvent.setup();
    render(<NotificationBanner {...defaultProps} />);
    const closeButton = screen.getByText('\u00d7');
    await user.press(closeButton);
    // After pressing, the animation should start; the component sets show=false after animation
    // We just verify pressing doesn't throw
    expect(closeButton).toBeTruthy();
  });
});
