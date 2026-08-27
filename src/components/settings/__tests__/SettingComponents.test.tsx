import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { SettingSwitch } from '../SettingSwitch';

jest.mock('#utils/iconUtils', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    Icon: ({ name }: { name: string }) =>
      R.createElement(RN.Text, { testID: `icon-${name}` }, name),
  };
});

jest.mock('#components/atoms/BaseSwitch', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    BaseSwitch: ({
      value,
      onValueChange,
      disabled,
      testID,
    }: {
      value: boolean;
      onValueChange: (value: boolean) => void;
      disabled?: boolean;
      testID?: string;
    }) =>
      R.createElement(RN.Switch, {
        value,
        onValueChange,
        disabled,
        testID: testID || 'base-switch',
      }),
  };
});

describe('SettingsSection', () => {
  it('renders title', () => {
    render(
      <SettingsSection variant="inset" title="General">
        <Text>Content</Text>
      </SettingsSection>,
    );
    expect(screen.getByText('General')).toBeTruthy();
  });

  it('renders children', () => {
    render(
      <SettingsSection variant="inset" title="General">
        <Text>Child Content</Text>
      </SettingsSection>,
    );
    expect(screen.getByText('Child Content')).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(
      <SettingsSection
        variant="inset"
        title="General"
        description="General settings"
      >
        <Text>Content</Text>
      </SettingsSection>,
    );
    expect(screen.getByText('General settings')).toBeTruthy();
  });

  it('does not render description when not provided', () => {
    render(
      <SettingsSection variant="inset" title="General">
        <Text>Content</Text>
      </SettingsSection>,
    );
    expect(screen.queryByText('General settings')).toBeNull();
  });
});

describe('SettingSwitch', () => {
  const defaultProps = {
    title: 'Push Notifications',
    value: false,
    onValueChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title', () => {
    render(<SettingSwitch {...defaultProps} />);
    expect(screen.getByText('Push Notifications')).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(
      <SettingSwitch
        {...defaultProps}
        description="Receive push notifications"
      />,
    );
    expect(screen.getByText('Receive push notifications')).toBeTruthy();
  });

  it('does not render description when not provided', () => {
    render(<SettingSwitch {...defaultProps} />);
    expect(screen.queryByText('Receive push notifications')).toBeNull();
  });

  it('renders a switch element', () => {
    render(<SettingSwitch {...defaultProps} />);
    expect(screen.getByTestId('base-switch')).toBeTruthy();
  });

  it('passes value to switch', () => {
    render(<SettingSwitch {...defaultProps} value={true} />);
    const switchEl = screen.getByTestId('base-switch');
    expect(switchEl.props.value).toBe(true);
  });

  it('calls onValueChange when switch is toggled', () => {
    render(<SettingSwitch {...defaultProps} />);
    const switchEl = screen.getByTestId('base-switch');
    fireEvent(switchEl, 'valueChange', true);
    expect(defaultProps.onValueChange).toHaveBeenCalledWith(true);
  });

  it('renders with custom testID', () => {
    render(<SettingSwitch {...defaultProps} testID="my-switch" />);
    expect(screen.getByTestId('my-switch')).toBeTruthy();
  });
});
