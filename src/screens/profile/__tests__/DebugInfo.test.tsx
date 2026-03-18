'use no memo';
import React from 'react';
import { Platform } from 'react-native';
import { render, screen } from '@testing-library/react-native';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) =>
    selector({ canAccessDevTools: false }),
  ),
  selectCanAccessDevTools: (s: any) => s.canAccessDevTools,
}));
jest.mock('#components/templates/ProfileScreenWrapper', () => ({
  ProfileScreenWrapper: ({ title, children }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        {children}
      </View>
    );
  },
}));

const mockShouldEnableDebugFeatures = jest.fn(() => true);
jest.mock('#/utils/environment', () => ({
  Environment: {
    getConfig: () => ({
      buildMode: 'development',
      isDevelopment: true,
      isStaging: false,
      isProduction: false,
      isTesting: true,
    }),
    getApiConfig: () => ({
      baseUrl: 'http://localhost:4000',
      wsUrl: 'ws://localhost:4000',
      timeout: 30000,
      retries: 3,
    }),
    shouldEnableDebugFeatures: () => mockShouldEnableDebugFeatures(),
  },
}));

// Set Platform.Version before importing the component
beforeAll(() => {
  Object.defineProperty(Platform, 'Version', {
    get: () => '17.0',
    configurable: true,
  });
});

// Lazy import to ensure Platform.Version is set first
const getDebugInfo = () => require('../DebugInfo').DebugInfo;

describe('DebugInfo', () => {
  beforeEach(() => {
    mockShouldEnableDebugFeatures.mockReturnValue(true);
  });

  it('renders debug info screen', () => {
    const DebugInfo = getDebugInfo();
    render(<DebugInfo />);
    expect(screen.getByText('Debug Info')).toBeTruthy();
  });

  it('shows environment section', () => {
    const DebugInfo = getDebugInfo();
    render(<DebugInfo />);
    expect(screen.getByText('Environment')).toBeTruthy();
  });

  it('shows Copy All Info button', () => {
    const DebugInfo = getDebugInfo();
    render(<DebugInfo />);
    expect(screen.getByText('Copy All Info')).toBeTruthy();
  });

  it('shows not available message when debug features disabled', () => {
    mockShouldEnableDebugFeatures.mockReturnValue(false);
    const DebugInfo = getDebugInfo();
    render(<DebugInfo />);
    expect(screen.getByText(/only available in development/)).toBeTruthy();
  });
});
