'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';
import { LeftActions } from '../LeftActions';
import type { ActionButtonProps, SwipeableRef } from '../types';

jest.mock('#/services/haptic/HapticService', () => ({
  HapticService: {
    light: jest.fn(),
    medium: jest.fn(),
    heavy: jest.fn(),
    selection: jest.fn(),
  },
}));

jest.mock('../SwipeActionButton', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    SwipeActionButton: ({ onPress, icon, testID }: ActionButtonProps) =>
      R.createElement(
        RN.Pressable,
        { onPress, testID: testID || `action-btn-${icon}` },
        R.createElement(RN.Text, null, icon),
      ),
  };
});

describe('LeftActions', () => {
  const mockClose = jest.fn();
  const mockSwipeableRef: SwipeableRef = {
    current: {
      close: mockClose,
      openLeft: jest.fn(),
      openRight: jest.fn(),
      reset: jest.fn(),
    },
  };
  const mockProgress: SharedValue<number> = {
    value: 0.5,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    modify: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when no action callbacks are provided', () => {
    const { toJSON } = render(<LeftActions progress={mockProgress} />);
    expect(toJSON()).toBeNull();
  });

  it('renders purchase toggle button when onTogglePurchase is provided', () => {
    const onTogglePurchase = jest.fn();
    render(
      <LeftActions
        onTogglePurchase={onTogglePurchase}
        isPurchased={false}
        swipeableRef={mockSwipeableRef}
        progress={mockProgress}
      />,
    );
    expect(screen.getByText('checkmark-circle')).toBeTruthy();
  });

  it('renders unpurchase icon when isPurchased is true', () => {
    render(
      <LeftActions
        onTogglePurchase={jest.fn()}
        isPurchased={true}
        swipeableRef={mockSwipeableRef}
        progress={mockProgress}
      />,
    );
    expect(screen.getByText('close-circle')).toBeTruthy();
  });

  it('calls onTogglePurchase and closes swipeable when purchase button is pressed', async () => {
    const user = userEvent.setup();
    const onTogglePurchase = jest.fn();
    render(
      <LeftActions
        onTogglePurchase={onTogglePurchase}
        isPurchased={false}
        swipeableRef={mockSwipeableRef}
        progress={mockProgress}
      />,
    );
    await user.press(screen.getByText('checkmark-circle'));
    expect(onTogglePurchase).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it('renders consume button when onConsume is provided alone', () => {
    render(
      <LeftActions
        onConsume={jest.fn()}
        swipeableRef={mockSwipeableRef}
        progress={mockProgress}
      />,
    );
    expect(screen.getByText('restaurant-outline')).toBeTruthy();
  });

  it('renders waste button when onWaste is provided alone', () => {
    render(
      <LeftActions
        onWaste={jest.fn()}
        swipeableRef={mockSwipeableRef}
        progress={mockProgress}
      />,
    );
    expect(screen.getByText('warning-outline')).toBeTruthy();
  });

  it('renders consume and waste buttons when both provided', () => {
    render(
      <LeftActions
        onConsume={jest.fn()}
        onWaste={jest.fn()}
        swipeableRef={mockSwipeableRef}
        progress={mockProgress}
      />,
    );
    expect(screen.getByText('restaurant-outline')).toBeTruthy();
    expect(screen.getByText('warning-outline')).toBeTruthy();
  });

  it('renders consume, waste, and restock buttons when all three provided', () => {
    render(
      <LeftActions
        onConsume={jest.fn()}
        onWaste={jest.fn()}
        onRestock={jest.fn()}
        swipeableRef={mockSwipeableRef}
        progress={mockProgress}
      />,
    );
    expect(screen.getByText('restaurant-outline')).toBeTruthy();
    expect(screen.getByText('warning-outline')).toBeTruthy();
    expect(screen.getByText('add-circle-outline')).toBeTruthy();
  });

  it('calls onConsume and closes swipeable when consume is pressed', async () => {
    const user = userEvent.setup();
    const onConsume = jest.fn();
    render(
      <LeftActions
        onConsume={onConsume}
        swipeableRef={mockSwipeableRef}
        progress={mockProgress}
      />,
    );
    await user.press(screen.getByText('restaurant-outline'));
    expect(onConsume).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it('renders edit button in shopping mode', () => {
    const onEdit = jest.fn();
    const onActionPress = jest.fn();
    render(
      <LeftActions
        swipeMode="shopping"
        onEdit={onEdit}
        onActionPress={onActionPress}
        swipeableRef={mockSwipeableRef}
        progress={mockProgress}
      />,
    );
    expect(screen.getByText('create-outline')).toBeTruthy();
  });

  it('fires edit action and closes swipeable in shopping mode', async () => {
    const user = userEvent.setup();
    const onEdit = jest.fn();
    const onActionPress = jest.fn();
    render(
      <LeftActions
        swipeMode="shopping"
        onEdit={onEdit}
        onActionPress={onActionPress}
        swipeableRef={mockSwipeableRef}
        progress={mockProgress}
      />,
    );
    await user.press(screen.getByText('create-outline'));
    expect(onActionPress).toHaveBeenCalledWith('edit');
    expect(mockClose).toHaveBeenCalled();
  });
});
