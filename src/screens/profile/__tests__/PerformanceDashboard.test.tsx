'use no memo';

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { PerformanceDashboard } from '../PerformanceDashboard';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockSetPerformanceEnabled = jest.fn();
const mockSetTrackRenders = jest.fn();
const mockSetTrackMemory = jest.fn();
const mockSetTrackScreens = jest.fn();
const mockClearPerformanceData = jest.fn();

jest.mock('#/store/performanceStore', () => ({
  usePerformanceStore: jest.fn((selector: any) =>
    selector({
      isEnabled: true,
      trackRenders: true,
      trackMemory: true,
      trackScreens: true,
      setPerformanceEnabled: mockSetPerformanceEnabled,
      setTrackRenders: mockSetTrackRenders,
      setTrackMemory: mockSetTrackMemory,
      setTrackScreens: mockSetTrackScreens,
      componentMetrics: new Map(),
      screenMetrics: new Map(),
      memorySnapshots: [],
      clearPerformanceData: mockClearPerformanceData,
    }),
  ),
}));

jest.mock('#/utils/environment', () => ({
  Environment: {
    shouldEnableDebugFeatures: jest.fn().mockReturnValue(true),
  },
}));

jest.mock('#/store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) =>
    selector({ isAdminUser: true }),
  ),
  selectIsAdminUser: (s: any) => s.isAdminUser,
}));

jest.mock('#components/settings/SettingSwitch', () => ({
  SettingSwitch: ({ title, value, onValueChange, disabled }: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        <Pressable
          testID={`switch-${title}`}
          onPress={() => onValueChange(!value)}
          disabled={disabled}
        >
          <Text>{value ? 'On' : 'Off'}</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('#components/settings/SettingSection', () => ({
  SettingSection: ({ title, children }: any) => {
    const { View, Text } = require('react-native');
    return <View><Text>{title}</Text>{children}</View>;
  },
}));

jest.mock('#components/templates/ProfileScreenWrapper', () => ({
  ProfileScreenWrapper: ({ title, children }: any) => {
    const { View, Text } = require('react-native');
    return <View testID="profile-wrapper"><Text>{title}</Text>{children}</View>;
  },
}));

jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

beforeEach(() => {
  jest.clearAllMocks();
  // Restore default mock implementations after clearAllMocks
  const { Environment } = require('#/utils/environment');
  Environment.shouldEnableDebugFeatures.mockReturnValue(true);

  const { useAppStore } = require('#/store/useAppStore');
  useAppStore.mockImplementation((selector: any) =>
    selector({ isAdminUser: true }),
  );

  const { usePerformanceStore } = require('#/store/performanceStore');
  usePerformanceStore.mockImplementation((selector: any) =>
    selector({
      isEnabled: true,
      trackRenders: true,
      trackMemory: true,
      trackScreens: true,
      setPerformanceEnabled: mockSetPerformanceEnabled,
      setTrackRenders: mockSetTrackRenders,
      setTrackMemory: mockSetTrackMemory,
      setTrackScreens: mockSetTrackScreens,
      componentMetrics: new Map(),
      screenMetrics: new Map(),
      memorySnapshots: [],
      clearPerformanceData: mockClearPerformanceData,
    }),
  );
});

describe('PerformanceDashboard', () => {
  it('renders dashboard title', () => {
    const { getByText } = render(<PerformanceDashboard />);
    expect(getByText('Performance Dashboard')).toBeTruthy();
  });

  it('renders performance tracking section', () => {
    const { getByText } = render(<PerformanceDashboard />);
    expect(getByText('Performance Tracking')).toBeTruthy();
  });

  it('renders all toggle switches', () => {
    const { getByText } = render(<PerformanceDashboard />);
    expect(getByText('Enable Performance Tracking')).toBeTruthy();
    expect(getByText('Track Component Renders')).toBeTruthy();
    expect(getByText('Track Memory Usage')).toBeTruthy();
    expect(getByText('Track Screen Transitions')).toBeTruthy();
  });

  it('shows empty state when no data', () => {
    const { getByText } = render(<PerformanceDashboard />);
    expect(getByText('No performance data collected yet.')).toBeTruthy();
  });

  it('shows not available for non-admin in production', () => {
    const { Environment } = require('#/utils/environment');
    Environment.shouldEnableDebugFeatures.mockReturnValue(false);

    const { useAppStore } = require('#/store/useAppStore');
    useAppStore.mockImplementation((selector: any) =>
      selector({ isAdminUser: false }),
    );

    const { getByText } = render(<PerformanceDashboard />);
    expect(getByText('Performance dashboard is only available to administrators.')).toBeTruthy();
  });

  it('shows clear button when metrics exist', () => {
    const { usePerformanceStore } = require('#/store/performanceStore');
    const metrics = new Map();
    metrics.set('TestComponent', {
      componentName: 'TestComponent',
      avgRenderTime: 10,
      maxRenderTime: 20,
      renderCount: 5,
    });

    usePerformanceStore.mockImplementation((selector: any) =>
      selector({
        isEnabled: true,
        trackRenders: true,
        trackMemory: false,
        trackScreens: false,
        setPerformanceEnabled: mockSetPerformanceEnabled,
        setTrackRenders: mockSetTrackRenders,
        setTrackMemory: mockSetTrackMemory,
        setTrackScreens: mockSetTrackScreens,
        componentMetrics: metrics,
        screenMetrics: new Map(),
        memorySnapshots: [],
        clearPerformanceData: mockClearPerformanceData,
      }),
    );

    const { getByText } = render(<PerformanceDashboard />);
    expect(getByText('Clear Performance Data')).toBeTruthy();
  });

  it('shows component metrics in table', () => {
    const { usePerformanceStore } = require('#/store/performanceStore');
    const metrics = new Map();
    metrics.set('TestComponent', {
      componentName: 'TestComponent',
      avgRenderTime: 10,
      maxRenderTime: 20,
      renderCount: 5,
    });

    usePerformanceStore.mockImplementation((selector: any) =>
      selector({
        isEnabled: true,
        trackRenders: true,
        trackMemory: false,
        trackScreens: false,
        setPerformanceEnabled: mockSetPerformanceEnabled,
        setTrackRenders: mockSetTrackRenders,
        setTrackMemory: mockSetTrackMemory,
        setTrackScreens: mockSetTrackScreens,
        componentMetrics: metrics,
        screenMetrics: new Map(),
        memorySnapshots: [],
        clearPerformanceData: mockClearPerformanceData,
      }),
    );

    const { getByText } = render(<PerformanceDashboard />);
    expect(getByText('TestComponent')).toBeTruthy();
    expect(getByText('Slowest Components')).toBeTruthy();
  });

  it('triggers clear data confirmation alert', () => {
    const { usePerformanceStore } = require('#/store/performanceStore');
    const metrics = new Map();
    metrics.set('Test', { componentName: 'Test', avgRenderTime: 1, maxRenderTime: 2, renderCount: 1 });

    usePerformanceStore.mockImplementation((selector: any) =>
      selector({
        isEnabled: true,
        trackRenders: true,
        trackMemory: false,
        trackScreens: false,
        setPerformanceEnabled: mockSetPerformanceEnabled,
        setTrackRenders: mockSetTrackRenders,
        setTrackMemory: mockSetTrackMemory,
        setTrackScreens: mockSetTrackScreens,
        componentMetrics: metrics,
        screenMetrics: new Map(),
        memorySnapshots: [],
        clearPerformanceData: mockClearPerformanceData,
      }),
    );

    const { getByText } = render(<PerformanceDashboard />);
    fireEvent.press(getByText('Clear Performance Data'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Clear Performance Data',
      expect.any(String),
      expect.any(Array),
    );
  });
});
