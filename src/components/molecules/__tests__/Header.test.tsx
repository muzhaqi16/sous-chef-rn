import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Header } from '../Header';

describe('Header', () => {
  it('renders title text', () => {
    render(<Header title="My Screen" />);
    expect(screen.getByText('My Screen')).toBeTruthy();
  });

  it('does not render title when not provided', () => {
    const { toJSON } = render(<Header />);
    expect(toJSON()).toBeTruthy();
    expect(screen.queryByText('My Screen')).toBeNull();
  });

  it('renders back button when onBack is provided', () => {
    const onBack = jest.fn();
    render(<Header title="Detail" onBack={onBack} />);
    const backButton = screen.getByTestId('header-back-button');
    expect(backButton).toBeTruthy();
  });

  it('calls onBack when back button is pressed', () => {
    const onBack = jest.fn();
    render(<Header title="Detail" onBack={onBack} />);
    fireEvent.press(screen.getByTestId('header-back-button'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders close button when onClose is provided', () => {
    const onClose = jest.fn();
    render(<Header title="Modal" onClose={onClose} />);
    const closeButton = screen.getByTestId('header-close-button');
    expect(closeButton).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    render(<Header title="Modal" onClose={onClose} />);
    fireEvent.press(screen.getByTestId('header-close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows close button instead of back when both are provided', () => {
    render(<Header title="Test" onBack={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByTestId('header-close-button')).toBeTruthy();
    expect(screen.queryByTestId('header-back-button')).toBeNull();
  });

  it('renders right actions with testIDs', () => {
    const onAction = jest.fn();
    render(
      <Header
        title="Test"
        rightActions={[
          { icon: 'settings', onPress: onAction, testID: 'settings-btn' },
        ]}
      />,
    );
    const actionBtn = screen.getByTestId('settings-btn');
    expect(actionBtn).toBeTruthy();
    fireEvent.press(actionBtn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders badge on action when badge count is provided', () => {
    render(
      <Header
        title="Test"
        rightActions={[
          {
            icon: 'notifications',
            onPress: jest.fn(),
            badge: 5,
            testID: 'notif-btn',
          },
        ]}
      />,
    );
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('does not render badge when badge is 0', () => {
    render(
      <Header
        title="Test"
        rightActions={[
          {
            icon: 'notifications',
            onPress: jest.fn(),
            badge: 0,
            testID: 'notif-btn',
          },
        ]}
      />,
    );
    expect(screen.queryByText('0')).toBeNull();
  });
});
