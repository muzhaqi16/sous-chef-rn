'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';
import { RightActions } from '../RightActions';
import type { ActionButtonProps } from '../types';

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

describe('RightActions', () => {
  const mockProgress: SharedValue<number> = {
    value: 0.5,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    modify: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  } as Partial<SharedValue<number>> as SharedValue<number>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when no edit or delete callbacks are provided', () => {
    const { toJSON } = render(<RightActions progress={mockProgress} />);
    expect(toJSON()).toBeNull();
  });

  it('renders edit button when onEdit is provided', () => {
    render(
      <RightActions
        onEdit={jest.fn()}
        onActionPress={jest.fn()}
        progress={mockProgress}
      />,
    );
    expect(screen.getByText('create-outline')).toBeTruthy();
  });

  it('renders delete button when onDelete is provided', () => {
    render(
      <RightActions
        onDelete={jest.fn()}
        onActionPress={jest.fn()}
        progress={mockProgress}
      />,
    );
    expect(screen.getByText('trash-outline')).toBeTruthy();
  });

  it('renders both edit and delete buttons when both are provided', () => {
    render(
      <RightActions
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onActionPress={jest.fn()}
        progress={mockProgress}
      />,
    );
    expect(screen.getByText('create-outline')).toBeTruthy();
    expect(screen.getByText('trash-outline')).toBeTruthy();
  });

  it('calls onActionPress with "edit" when edit button is pressed', async () => {
    const user = userEvent.setup();
    const onActionPress = jest.fn();
    render(
      <RightActions
        onEdit={jest.fn()}
        onActionPress={onActionPress}
        progress={mockProgress}
      />,
    );
    await user.press(screen.getByText('create-outline'));
    expect(onActionPress).toHaveBeenCalledWith('edit');
  });

  it('calls onActionPress with "delete" when delete button is pressed', async () => {
    const user = userEvent.setup();
    const onActionPress = jest.fn();
    render(
      <RightActions
        onDelete={jest.fn()}
        onActionPress={onActionPress}
        progress={mockProgress}
      />,
    );
    await user.press(screen.getByText('trash-outline'));
    expect(onActionPress).toHaveBeenCalledWith('delete');
  });

  it('triggers haptic feedback on edit press', async () => {
    const user = userEvent.setup();
    const { HapticService } = require('#/services/haptic/HapticService');
    render(
      <RightActions
        onEdit={jest.fn()}
        onActionPress={jest.fn()}
        progress={mockProgress}
      />,
    );
    await user.press(screen.getByText('create-outline'));
    expect(HapticService.light).toHaveBeenCalled();
  });

  it('triggers haptic feedback on delete press', async () => {
    const user = userEvent.setup();
    const { HapticService } = require('#/services/haptic/HapticService');
    render(
      <RightActions
        onDelete={jest.fn()}
        onActionPress={jest.fn()}
        progress={mockProgress}
      />,
    );
    await user.press(screen.getByText('trash-outline'));
    expect(HapticService.light).toHaveBeenCalled();
  });

  it('in shopping mode, only shows delete on right', () => {
    render(
      <RightActions
        swipeMode="shopping"
        onDelete={jest.fn()}
        onEdit={jest.fn()}
        onActionPress={jest.fn()}
        progress={mockProgress}
      />,
    );
    expect(screen.getByText('trash-outline')).toBeTruthy();
    expect(screen.queryByText('create-outline')).toBeNull();
  });

  it('in shopping mode, returns null when no onDelete', () => {
    const { toJSON } = render(
      <RightActions
        swipeMode="shopping"
        onEdit={jest.fn()}
        onActionPress={jest.fn()}
        progress={mockProgress}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders testID with prefix for edit button', () => {
    render(
      <RightActions
        onEdit={jest.fn()}
        onActionPress={jest.fn()}
        testIDPrefix="item-1"
        progress={mockProgress}
      />,
    );
    expect(screen.getByTestId('item-1-edit')).toBeTruthy();
  });

  it('renders testID with prefix for delete button', () => {
    render(
      <RightActions
        onDelete={jest.fn()}
        onActionPress={jest.fn()}
        testIDPrefix="item-1"
        progress={mockProgress}
      />,
    );
    expect(screen.getByTestId('item-1-delete')).toBeTruthy();
  });
});
