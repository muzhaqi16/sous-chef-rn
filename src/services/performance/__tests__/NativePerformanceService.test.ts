import performance, {
  PerformanceObserver,
  setResourceLoggingEnabled,
} from 'react-native-performance';
import { Telemetry } from '#/services/telemetry';
import { NativePerformanceService } from '../NativePerformanceService';

interface MockObserver {
  observe: jest.Mock;
  disconnect: jest.Mock;
  _callback: (list: {
    getEntries: () => Array<Record<string, unknown>>;
  }) => void;
}

const observers: MockObserver[] = [];

jest.mock('react-native-performance', () => {
  return {
    __esModule: true,
    default: {
      mark: jest.fn(),
      measure: jest.fn(),
    },
    PerformanceObserver: jest.fn().mockImplementation(callback => {
      const observer = {
        observe: jest.fn(),
        disconnect: jest.fn(),
        _callback: callback,
      };
      observers.push(observer);
      return observer;
    }),
    setResourceLoggingEnabled: jest.fn(),
  };
});

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    histogram: jest.fn(),
  },
}));

jest.mock('#/config/env', () => ({
  env: { API_URL: 'https://api.example.com/graphql' },
}));

// Environment is auto-mocked via jest.setup.js; override `getApiConfig` so
// the perf-API URL matches the assertions below.
import { Environment } from '#/utils/environment';

describe('NativePerformanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    observers.length = 0;
    (Environment.getApiConfig as jest.Mock).mockReturnValue({
      baseUrl: 'https://api.example.com/graphql',
    });
  });

  afterEach(() => {
    NativePerformanceService.cleanup();
  });

  describe('initialize', () => {
    it('creates 3 PerformanceObservers', () => {
      NativePerformanceService.initialize();

      expect(PerformanceObserver).toHaveBeenCalledTimes(3);
      expect(observers).toHaveLength(3);

      // Verify each observer was told to observe a specific type
      expect(observers[0].observe).toHaveBeenCalledWith({
        type: 'react-native-mark',
        buffered: true,
      });
      expect(observers[1].observe).toHaveBeenCalledWith({
        type: 'measure',
        buffered: true,
      });
      expect(observers[2].observe).toHaveBeenCalledWith({
        type: 'resource',
        buffered: true,
      });

      expect(setResourceLoggingEnabled).toHaveBeenCalledWith(true);
    });

    it('guards against double initialization', () => {
      NativePerformanceService.initialize();
      NativePerformanceService.initialize();

      expect(PerformanceObserver).toHaveBeenCalledTimes(3);
    });
  });

  describe('cleanup', () => {
    it('disconnects all observers and resets state', () => {
      NativePerformanceService.initialize();
      const capturedObservers = [...observers];

      NativePerformanceService.cleanup();

      capturedObservers.forEach(obs => {
        expect(obs.disconnect).toHaveBeenCalled();
      });

      // After cleanup, initialize should work again
      observers.length = 0;
      jest.clearAllMocks();
      NativePerformanceService.initialize();
      expect(PerformanceObserver).toHaveBeenCalledTimes(3);
    });
  });

  describe('mark', () => {
    it('delegates to performance.mark', () => {
      NativePerformanceService.mark('my_mark');
      expect(performance.mark).toHaveBeenCalledWith('my_mark');
    });
  });

  describe('measure', () => {
    it('delegates to performance.measure', () => {
      NativePerformanceService.measure('my_measure', 'start', 'end');
      expect(performance.measure).toHaveBeenCalledWith(
        'my_measure',
        'start',
        'end',
      );
    });

    it('passes undefined endMark when not provided', () => {
      NativePerformanceService.measure('my_measure', 'start');
      expect(performance.measure).toHaveBeenCalledWith(
        'my_measure',
        'start',
        undefined,
      );
    });
  });

  describe('native marks observer', () => {
    it('reports nativeLaunchStart/End to Telemetry.histogram', () => {
      NativePerformanceService.initialize();
      const nativeMarkObserver = observers[0];

      nativeMarkObserver._callback({
        getEntries: () => [
          { name: 'nativeLaunchStart', startTime: 100 },
          { name: 'nativeLaunchEnd', startTime: 350 },
        ],
      });

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'app_native_launch_ms',
        250,
        { type: 'native_init' },
      );
    });

    it('reports runJsBundleStart/End to Telemetry.histogram', () => {
      NativePerformanceService.initialize();
      const nativeMarkObserver = observers[0];

      nativeMarkObserver._callback({
        getEntries: () => [
          { name: 'runJsBundleStart', startTime: 400 },
          { name: 'runJsBundleEnd', startTime: 600 },
        ],
      });

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'app_js_bundle_load_ms',
        200,
        { type: 'hermes_bytecode' },
      );
    });
  });

  describe('measure observer', () => {
    it('routes screen:Home:mount to Telemetry.histogram', () => {
      NativePerformanceService.initialize();
      const measObserver = observers[1];

      measObserver._callback({
        getEntries: () => [{ name: 'screen:Home:mount', duration: 120 }],
      });

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'screen_mount_duration_ms',
        120,
        { screen: 'Home' },
      );
    });

    it('routes component:MyList:render to component_render_duration_ms histogram', () => {
      NativePerformanceService.initialize();
      const measObserver = observers[1];

      measObserver._callback({
        getEntries: () => [{ name: 'component:MyList:render', duration: 15 }],
      });

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'component_render_duration_ms',
        15,
        { component: 'MyList' },
      );
    });
  });

  describe('resource observer', () => {
    it('filters out GraphQL host', () => {
      NativePerformanceService.initialize();
      const resObserver = observers[2];

      resObserver._callback({
        getEntries: () => [
          { name: 'https://api.example.com/graphql', duration: 200 },
        ],
      });

      // Should NOT report because the host matches the GraphQL host
      expect(Telemetry.histogram).not.toHaveBeenCalled();
    });

    it('reports non-GraphQL resources', () => {
      NativePerformanceService.initialize();
      const resObserver = observers[2];

      resObserver._callback({
        getEntries: () => [
          { name: 'https://cdn.example.com/image.png', duration: 150 },
        ],
      });

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'http_request_duration_ms',
        150,
        { host: 'cdn.example.com' },
      );
    });
  });
});
