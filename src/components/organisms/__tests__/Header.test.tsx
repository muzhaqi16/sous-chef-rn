import React from 'react';
import { View } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';
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

  it('opens what a pressable title opens, with its accessory beside it', async () => {
    const user = userEvent.setup();
    const onTitlePress = jest.fn();
    render(
      <Header
        title="East End Food Co-Op"
        centerTitle
        onTitlePress={onTitlePress}
        titleAccessory={<View testID="title-chevron" />}
      />,
    );

    await user.press(screen.getByTestId('header-title-button'));

    expect(onTitlePress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('East End Food Co-Op')).toBeTruthy();
    expect(screen.getByTestId('title-chevron')).toBeTruthy();
  });

  it('keeps a title that opens nothing out of the press order', () => {
    render(<Header title="Detail" titleAccessory={<View />} />);
    expect(screen.queryByTestId('header-title-button')).toBeNull();
  });

  it('renders back button when onBack is provided', () => {
    const onBack = jest.fn();
    render(<Header title="Detail" onBack={onBack} />);
    const backButton = screen.getByTestId('header-back-button');
    expect(backButton).toBeTruthy();
  });

  it('calls onBack when back button is pressed', async () => {
    const user = userEvent.setup();
    const onBack = jest.fn();
    render(<Header title="Detail" onBack={onBack} />);
    await user.press(screen.getByTestId('header-back-button'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders close button when onClose is provided', () => {
    const onClose = jest.fn();
    render(<Header title="Modal" onClose={onClose} />);
    const closeButton = screen.getByTestId('header-close-button');
    expect(closeButton).toBeTruthy();
  });

  it('calls onClose when close button is pressed', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<Header title="Modal" onClose={onClose} />);
    await user.press(screen.getByTestId('header-close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows close button instead of back when both are provided', () => {
    render(<Header title="Test" onBack={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByTestId('header-close-button')).toBeTruthy();
    expect(screen.queryByTestId('header-back-button')).toBeNull();
  });

  it('renders right actions with testIDs', async () => {
    const user = userEvent.setup();
    const onAction = jest.fn();
    render(
      <Header
        title="Test"
        rightActions={[
          {
            icon: 'settings',
            accessibilityLabel: 'Settings',
            onPress: onAction,
            testID: 'settings-btn',
          },
        ]}
      />,
    );
    const actionBtn = screen.getByTestId('settings-btn');
    expect(actionBtn).toBeTruthy();
    await user.press(actionBtn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders badge on action when badge count is provided', () => {
    render(
      <Header
        title="Test"
        rightActions={[
          {
            icon: 'notifications',
            accessibilityLabel: 'Notifications',
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
            accessibilityLabel: 'Notifications',
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
