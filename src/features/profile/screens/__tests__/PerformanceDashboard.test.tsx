'use no memo';

import React from 'react';
import { render, userEvent } from '@testing-library/react-native';
import { alertService } from '#/services/alertService';
import { MemoryMonitor } from '#/services/performance/MemoryMonitor';
import { PerformanceDashboard } from '../PerformanceDashboard';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/services/performance/MemoryMonitor', () => ({
  MemoryMonitor: {
    start: jest.fn(),
    stop: jest.fn(),
    takeSnapshot: jest.fn().mockResolvedValue(null),
    isEnabled: jest.fn().mockReturnValue(false),
  },
}));

const mockFPSStats = {
  current: 58,
  min: 42,
  max: 60,
  avg: 55,
  lowFPSCount: 3,
};

jest.mock('#/hooks/performance/useFPSMonitor', () => ({
  useFPSMonitor: () => ({
    fps: 58,
    isLowFPS: false,
    isMonitoring: true,
    stats: mockFPSStats,
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    resetStats: jest.fn(),
  }),
}));

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

// Environment is auto-mocked via jest.setup.js; the default
// `shouldEnableDebugFeatures` returns true, which is what this suite expects.

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) =>
    selector({ canAccessDevTools: true }),
  ),
  useCanAccessDevTools: jest.fn(() => true),
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
    return (
      <View>
        <Text>{title}</Text>
        {children}
      </View>
    );
  },
}));

jest.mock('#components/templates/ProfileScreenWrapper', () => ({
  ProfileScreenWrapper: ({ title, children }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="profile-wrapper">
        <Text>{title}</Text>
        {children}
      </View>
    );
  },
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeRefreshWithFinally: jest.fn(
    async (fn: () => Promise<unknown>, setRefreshing: (v: boolean) => void) => {
      setRefreshing(true);
      await fn();
      setRefreshing(false);
    },
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Restore default mock implementations after clearAllMocks
  const { Environment } = require('#/utils/environment');
  Environment.shouldEnableDebugFeatures.mockReturnValue(true);

  const { useAppStore } = require('#store/useAppStore');
  useAppStore.mockImplementation((selector: any) =>
    selector({ canAccessDevTools: true }),
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

    const storeModule = require('#store/useAppStore');
    storeModule.useAppStore.mockImplementation((selector: any) =>
      selector({ canAccessDevTools: false }),
    );
    storeModule.useCanAccessDevTools.mockReturnValue(false);

    const { getByText } = render(<PerformanceDashboard />);
    expect(
      getByText('Performance dashboard is only available to administrators.'),
    ).toBeTruthy();
  });

  it('shows clear button when metrics exist', () => {
    const { usePerformanceStore } = require('#/store/performanceStore');
    const metrics = new Map();
    metrics.set('TestComponent', {
      componentName: 'TestComponent',
      avgRenderTime: 10,
      maxRenderTime: 20,
      totalRenderTime: 50,
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

  it('shows component metrics in table with Total column', () => {
    const { usePerformanceStore } = require('#/store/performanceStore');
    const metrics = new Map();
    metrics.set('TestComponent', {
      componentName: 'TestComponent',
      avgRenderTime: 10,
      maxRenderTime: 20,
      totalRenderTime: 50,
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
    // Verify Total column header exists
    expect(getByText('Total')).toBeTruthy();
    // Verify total render time is displayed (50ms formatted)
    expect(getByText('50.00ms')).toBeTruthy();
  });

  it('triggers clear data confirmation alert', async () => {
    const user = userEvent.setup();
    const { usePerformanceStore } = require('#/store/performanceStore');
    const metrics = new Map();
    metrics.set('Test', {
      componentName: 'Test',
      avgRenderTime: 1,
      maxRenderTime: 2,
      totalRenderTime: 3,
      renderCount: 1,
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
    await user.press(getByText('Clear Performance Data'));

    expect(alertService.alert).toHaveBeenCalledWith(
      'Clear Performance Data',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('starts MemoryMonitor when memory toggle is turned on', async () => {
    const user = userEvent.setup();
    const { usePerformanceStore } = require('#/store/performanceStore');
    usePerformanceStore.mockImplementation((selector: any) =>
      selector({
        isEnabled: true,
        trackRenders: true,
        trackMemory: false,
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

    const { getByTestId } = render(<PerformanceDashboard />);
    await user.press(getByTestId('switch-Track Memory Usage'));

    expect(mockSetTrackMemory).toHaveBeenCalledWith(true);
    expect(MemoryMonitor.start).toHaveBeenCalledWith(10000);
  });

  it('stops MemoryMonitor when memory toggle is turned off', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<PerformanceDashboard />);
    // trackMemory is true by default, pressing toggles it off
    await user.press(getByTestId('switch-Track Memory Usage'));

    expect(mockSetTrackMemory).toHaveBeenCalledWith(false);
    expect(MemoryMonitor.stop).toHaveBeenCalled();
  });

  it('stops MemoryMonitor when master toggle is disabled', async () => {
    const user = userEvent.setup();
    (MemoryMonitor.isEnabled as jest.Mock).mockReturnValue(true);

    const { getByTestId } = render(<PerformanceDashboard />);
    await user.press(getByTestId('switch-Enable Performance Tracking'));

    expect(mockSetPerformanceEnabled).toHaveBeenCalledWith(false);
    expect(MemoryMonitor.stop).toHaveBeenCalled();
  });

  it('shows current memory card when snapshots exist', () => {
    const { usePerformanceStore } = require('#/store/performanceStore');
    const snapshots = [
      {
        timestamp: 1000,
        usedBytes: 524288000,
        limitBytes: 1073741824,
        usagePercent: 48.8,
        context: 'periodic_sample',
      },
      {
        timestamp: 2000,
        usedBytes: 536870912,
        limitBytes: 1073741824,
        usagePercent: 50.0,
        context: 'periodic_sample',
      },
    ];

    usePerformanceStore.mockImplementation((selector: any) =>
      selector({
        isEnabled: true,
        trackRenders: false,
        trackMemory: true,
        trackScreens: false,
        setPerformanceEnabled: mockSetPerformanceEnabled,
        setTrackRenders: mockSetTrackRenders,
        setTrackMemory: mockSetTrackMemory,
        setTrackScreens: mockSetTrackScreens,
        componentMetrics: new Map(),
        screenMetrics: new Map(),
        memorySnapshots: snapshots,
        clearPerformanceData: mockClearPerformanceData,
      }),
    );

    const { getByText, getAllByText } = render(<PerformanceDashboard />);
    expect(getByText('Memory Usage')).toBeTruthy();
    expect(getByText('Current')).toBeTruthy();
    expect(getByText('Recent History')).toBeTruthy();
    // Verify current memory shows latest snapshot's usage percent (appears in card + history)
    expect(getAllByText('50.0%').length).toBeGreaterThanOrEqual(1);
  });

  it('renders FPS section in DEV mode', () => {
    const { getByText } = render(<PerformanceDashboard />);
    expect(getByText('Live FPS')).toBeTruthy();
    expect(getByText('58')).toBeTruthy();
    expect(getByText('42 / 55 / 60')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('shows last updated timestamp', () => {
    const { getByText } = render(<PerformanceDashboard />);
    expect(getByText(/Last updated:/)).toBeTruthy();
  });
});
