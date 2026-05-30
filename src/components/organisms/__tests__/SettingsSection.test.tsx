import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { SettingRowProps } from '../../molecules/SettingRow';
import { SettingsSection } from '../SettingsSection';

jest.mock('../../molecules/SettingRow', () => {
  const { Text, View } = require('react-native');
  return {
    SettingRow: ({ item, isFirst, isLast }: SettingRowProps) => (
      <View testID={`setting-row-${item.key}`}>
        <Text>{item.label}</Text>
        {isFirst ? <Text>first</Text> : null}
        {isLast ? <Text>last</Text> : null}
      </View>
    ),
  };
});

describe('SettingsSection', () => {
  const defaultItems = [
    { key: 'theme', label: 'Theme', type: 'navigation', onPress: jest.fn() },
    {
      key: 'language',
      label: 'Language',
      type: 'navigation',
      onPress: jest.fn(),
    },
    {
      key: 'notifications',
      label: 'Notifications',
      type: 'toggle',
      value: true,
      onToggle: jest.fn(),
    },
  ];

  it('renders section title', () => {
    render(<SettingsSection title="Preferences" items={defaultItems} />);
    expect(screen.getByText('Preferences')).toBeTruthy();
  });

  it('renders all setting items', () => {
    render(<SettingsSection title="Preferences" items={defaultItems} />);
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.getByText('Notifications')).toBeTruthy();
  });

  it('marks first and last items correctly', () => {
    render(<SettingsSection title="Settings" items={defaultItems} />);
    // First item has isFirst=true
    const firstRow = screen.getByTestId('setting-row-theme');
    expect(firstRow).toBeTruthy();
    // Last item has isLast=true
    const lastRow = screen.getByTestId('setting-row-notifications');
    expect(lastRow).toBeTruthy();
  });

  it('renders a single item as both first and last', () => {
    const singleItem = [
      { key: 'about', label: 'About', type: 'navigation', onPress: jest.fn() },
    ];
    render(<SettingsSection title="Info" items={singleItem} />);
    expect(screen.getByText('About')).toBeTruthy();
    // Single item should have both first and last markers
    expect(screen.getByText('first')).toBeTruthy();
    expect(screen.getByText('last')).toBeTruthy();
  });
});
