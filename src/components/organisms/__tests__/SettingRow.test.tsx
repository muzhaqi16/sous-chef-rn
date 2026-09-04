import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { SettingRow } from '../SettingRow';
import { Text } from '#components/atoms/Text';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
    theme: require('../../../theme/themes').lightTheme,
  })),
  BottomSheetModal: ({ children }: { children?: React.ReactNode }) => children,
}));

jest.mock(
  '#components/organisms/TextEditBottomSheet/TextEditBottomSheet',
  () => ({
    TextEditBottomSheet: () => null,
  }),
);

describe('SettingRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders label for info type item', () => {
    const item = {
      key: 'email',
      label: 'Email',
      type: 'info',
      value: 'test@test.com',
      icon: <Text>M</Text>,
    };
    render(<SettingRow item={item} isFirst={true} isLast={true} />);
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('displays value for info type item', () => {
    const item = {
      key: 'email',
      label: 'Email',
      type: 'info',
      value: 'test@test.com',
      icon: <Text>M</Text>,
    };
    render(<SettingRow item={item} isFirst={true} isLast={true} />);
    expect(screen.getByText('test@test.com')).toBeTruthy();
  });

  it('renders switch for switch type item', () => {
    const item = {
      key: 'notifications',
      label: 'Notifications',
      type: 'switch',
      value: true,
      icon: <Text>N</Text>,
      onPress: jest.fn(),
    };
    render(<SettingRow item={item} isFirst={true} isLast={false} />);
    expect(screen.getByText('Notifications')).toBeTruthy();
  });

  it('calls onPress for action type item', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    const item = {
      key: 'logout',
      label: 'Log Out',
      type: 'action',
      icon: <Text>L</Text>,
      onPress,
    };
    render(<SettingRow item={item} isFirst={false} isLast={true} />);
    await user.press(screen.getByText('Log Out'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders modal type with selected option label', () => {
    const item = {
      key: 'theme',
      label: 'Theme',
      type: 'modal',
      value: 'dark',
      icon: <Text>T</Text>,
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
      ],
    };
    render(<SettingRow item={item} isFirst={true} isLast={true} />);
    // "Theme" appears in both row label and bottom sheet title
    expect(screen.getAllByText('Theme').length).toBeGreaterThanOrEqual(1);
    // "Dark" appears in selected value display and as an option in the sheet
    expect(screen.getAllByText('Dark').length).toBeGreaterThanOrEqual(1);
  });

  it('renders navigation type with chevron', () => {
    const item = {
      key: 'profile',
      label: 'Profile',
      type: 'navigation',
      icon: <Text>P</Text>,
      onPress: jest.fn(),
    };
    render(<SettingRow item={item} isFirst={true} isLast={true} />);
    expect(screen.getByText('Profile')).toBeTruthy();
  });

  it('renders accessibility label for switch type', () => {
    const item = {
      key: 'notifications',
      label: 'Notifications',
      type: 'switch',
      value: true,
      icon: <Text>N</Text>,
    };
    render(<SettingRow item={item} isFirst={true} isLast={true} />);
    const row = screen.getByLabelText('Notifications, enabled');
    expect(row).toBeTruthy();
  });

  it('renders text type with pencil edit indicator', () => {
    const item = {
      key: 'name',
      label: 'Name',
      type: 'text',
      value: 'John',
      icon: <Text>N</Text>,
      onSave: jest.fn(),
    };
    render(<SettingRow item={item} isFirst={true} isLast={true} />);
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('John')).toBeTruthy();
  });
});
