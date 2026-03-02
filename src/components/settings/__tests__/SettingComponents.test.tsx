import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SettingRow } from '../SettingRow';
import { SettingSection } from '../SettingSection';
import { SettingSwitch } from '../SettingSwitch';

jest.mock('#utils/iconUtils', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    Icon: ({ name }: { name: string }) =>
      R.createElement(RN.Text, { testID: `icon-${name}` }, name),
  };
});

jest.mock('#components/base/BaseSwitch', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    BaseSwitch: ({ value, onValueChange, disabled, testID }: any) =>
      R.createElement(RN.Switch, {
        value,
        onValueChange,
        disabled,
        testID: testID || 'base-switch',
      }),
  };
});

describe('SettingRow', () => {
  const defaultProps = {
    title: 'Dark Mode',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title', () => {
    render(<SettingRow {...defaultProps} />);
    expect(screen.getByText('Dark Mode')).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(<SettingRow {...defaultProps} description="Enable dark theme" />);
    expect(screen.getByText('Enable dark theme')).toBeTruthy();
  });

  it('does not render description when not provided', () => {
    render(<SettingRow {...defaultProps} />);
    expect(screen.queryByText('Enable dark theme')).toBeNull();
  });

  it('renders value when provided', () => {
    render(<SettingRow {...defaultProps} value="On" />);
    expect(screen.getByText('On')).toBeTruthy();
  });

  it('renders icon when provided', () => {
    render(<SettingRow {...defaultProps} icon="moon-outline" />);
    expect(screen.getByTestId('icon-moon-outline')).toBeTruthy();
  });

  it('renders arrow by default', () => {
    render(<SettingRow {...defaultProps} />);
    expect(screen.getByTestId('icon-chevron-right')).toBeTruthy();
  });

  it('does not render arrow when showArrow is false', () => {
    render(<SettingRow {...defaultProps} showArrow={false} />);
    expect(screen.queryByTestId('icon-chevron-right')).toBeNull();
  });

  it('calls onPress when pressed', () => {
    render(<SettingRow {...defaultProps} />);
    fireEvent.press(screen.getByText('Dark Mode'));
    expect(defaultProps.onPress).toHaveBeenCalled();
  });

  it('renders when disabled', () => {
    render(<SettingRow {...defaultProps} disabled />);
    expect(screen.getByText('Dark Mode')).toBeTruthy();
  });
});

describe('SettingSection', () => {
  it('renders title', () => {
    render(
      <SettingSection title="General">
        <Text>Content</Text>
      </SettingSection>,
    );
    expect(screen.getByText('General')).toBeTruthy();
  });

  it('renders children', () => {
    render(
      <SettingSection title="General">
        <Text>Child Content</Text>
      </SettingSection>,
    );
    expect(screen.getByText('Child Content')).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(
      <SettingSection title="General" description="General settings">
        <Text>Content</Text>
      </SettingSection>,
    );
    expect(screen.getByText('General settings')).toBeTruthy();
  });

  it('does not render description when not provided', () => {
    render(
      <SettingSection title="General">
        <Text>Content</Text>
      </SettingSection>,
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
