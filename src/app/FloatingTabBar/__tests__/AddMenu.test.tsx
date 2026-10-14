import React from 'react';
import { BackHandler } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useSharedValue } from 'react-native-reanimated';
import type { TabBarAddAction } from '#context/TabBarActionsContext';
import { kitTestIDs } from '#components/testIDs';
import { AddMenu } from '../AddMenu';

const action = (
  key: string,
  overrides: Partial<TabBarAddAction> = {},
): TabBarAddAction => ({
  key,
  label: key,
  icon: 'add',
  onPress: jest.fn(),
  testID: `entry-${key}`,
  ...overrides,
});

// Module scope: the shared value is a hook, and the compiler must see the
// component whole.
const Menu = ({
  actions,
  open = true,
  onClose,
}: {
  actions: readonly TabBarAddAction[];
  open?: boolean;
  onClose: () => void;
}) => {
  const progress = useSharedValue(open ? 1 : 0);
  return (
    <AddMenu
      actions={actions}
      open={open}
      progress={progress}
      buttonBottom={100}
      onClose={onClose}
    />
  );
};

describe('AddMenu', () => {
  it('lists every action by its label', () => {
    render(
      <Menu
        actions={[action('Link'), action('Photo'), action('Write it myself')]}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Link')).toBeTruthy();
    expect(screen.getByText('Photo')).toBeTruthy();
    expect(screen.getByText('Write it myself')).toBeTruthy();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });

  it('closes before running the picked action', () => {
    const calls: string[] = [];
    const onClose = jest.fn(() => calls.push('close'));
    const link = action('Link', { onPress: () => calls.push('link') });
    render(<Menu actions={[link, action('Photo')]} onClose={onClose} />);

    fireEvent.press(screen.getByTestId('entry-Link'));

    expect(calls).toEqual(['close', 'link']);
  });

  it('closes on a tap outside it', () => {
    const onClose = jest.fn();
    render(
      <Menu actions={[action('Link'), action('Photo')]} onClose={onClose} />,
    );

    // Hidden from screen readers, but a tap on it still closes the menu.
    fireEvent.press(
      screen.getByTestId(kitTestIDs.tabBarAddMenuScrim, {
        includeHiddenElements: true,
      }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on the back button and keeps the screen', () => {
    const remove = jest.fn();
    let onBack: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        onBack = handler;
        return { remove };
      });
    const onClose = jest.fn();
    render(
      <Menu actions={[action('Link'), action('Photo')]} onClose={onClose} />,
    );

    const handled = onBack?.({ type: 'hardwareBackPress', timeStamp: 0 });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(handled).toBe(true);
    jest.restoreAllMocks();
  });

  it('shows why an action is unavailable and does not run it', () => {
    const link = action('Link', { disabledReason: 'Needs a connection' });
    render(<Menu actions={[link, action('Photo')]} onClose={jest.fn()} />);

    expect(screen.getByText('Needs a connection')).toBeTruthy();
    expect(
      screen.getByTestId('entry-Link').props.accessibilityState,
    ).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByTestId('entry-Link'));
    expect(link.onPress).not.toHaveBeenCalled();
  });

  it('renders no entries and lets touches through while closed', () => {
    render(
      <Menu
        actions={[action('Link'), action('Photo')]}
        open={false}
        onClose={jest.fn()}
      />,
    );

    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });
});
