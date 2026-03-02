import { getUsedMemory, getTotalMemory } from 'react-native-device-info';
import { Telemetry } from '#/services/telemetry';
import { MemoryMonitor } from '../MemoryMonitor';

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    gauge: jest.fn(),
    increment: jest.fn(),
  },
}));

jest.mock('react-native-device-info', () => ({
  getUsedMemory: jest.fn(),
  getTotalMemory: jest.fn(),
}));

jest.mock('#/store/performanceStore', () => ({
  usePerformanceStore: {
    getState: jest.fn(() => ({
      addMemorySnapshot: jest.fn(),
    })),
  },
}));

describe('MemoryMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Set system time to a known baseline; advance forward for each test group
    // to avoid cooldown contamination from the singleton's persisted lastWarningTime.
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    (getUsedMemory as jest.Mock).mockResolvedValue(500_000_000);
    (getTotalMemory as jest.Mock).mockResolvedValue(1_000_000_000);
  });

  afterEach(() => {
    MemoryMonitor.stop();
    MemoryMonitor.clearSnapshots();
    jest.useRealTimers();
  });

  describe('start', () => {
    it('sets enabled to true and takes initial snapshot', async () => {
      MemoryMonitor.start(10_000);
      expect(MemoryMonitor.isEnabled()).toBe(true);

      // Flush the initial takeSnapshot promise (only advance microtasks, not timers)
      await Promise.resolve();
      expect(getUsedMemory).toHaveBeenCalledTimes(1);
    });

    it('does nothing if already running (double-start guard)', async () => {
      MemoryMonitor.start(10_000);
      MemoryMonitor.start(10_000);
      await Promise.resolve();

      // Only one initial snapshot should have been taken
      expect(getUsedMemory).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('clears interval and sets enabled to false', async () => {
      MemoryMonitor.start(10_000);
      await Promise.resolve();

      MemoryMonitor.stop();
      expect(MemoryMonitor.isEnabled()).toBe(false);

      // Advance past the interval - no new snapshot should be taken
      jest.clearAllMocks();
      await jest.advanceTimersByTimeAsync(30_000);
      expect(getUsedMemory).not.toHaveBeenCalled();
    });
  });

  describe('takeSnapshot', () => {
    it('calls DeviceInfo.getUsedMemory() and getTotalMemory()', async () => {
      await MemoryMonitor.takeSnapshot('test');
      expect(getUsedMemory).toHaveBeenCalledTimes(1);
      expect(getTotalMemory).toHaveBeenCalledTimes(1);
    });

    it('returns null if DeviceInfo throws', async () => {
      (getUsedMemory as jest.Mock).mockRejectedValue(new Error('unavailable'));
      const result = await MemoryMonitor.takeSnapshot('test');
      expect(result).toBeNull();
    });

    it('calculates usagePercent correctly', async () => {
      (getUsedMemory as jest.Mock).mockResolvedValue(750_000_000);
      (getTotalMemory as jest.Mock).mockResolvedValue(1_000_000_000);

      const snapshot = await MemoryMonitor.takeSnapshot('test');
      expect(snapshot).not.toBeNull();
      expect(snapshot!.usagePercent).toBe(75);
      expect(snapshot!.usedBytes).toBe(750_000_000);
      expect(snapshot!.limitBytes).toBe(1_000_000_000);
    });

    it('reports to Telemetry.gauge', async () => {
      await MemoryMonitor.takeSnapshot('my_context');

      expect(Telemetry.gauge).toHaveBeenCalledWith(
        'app_memory_used_bytes',
        500_000_000,
        { context: 'my_context' },
      );
      expect(Telemetry.gauge).toHaveBeenCalledWith(
        'app_memory_limit_bytes',
        1_000_000_000,
      );
      expect(Telemetry.gauge).toHaveBeenCalledWith(
        'app_memory_usage_percent',
        50,
      );
    });

    it('trims snapshots when exceeding maxSnapshots (100)', async () => {
      for (let i = 0; i < 105; i++) {
        await MemoryMonitor.takeSnapshot('fill');
      }

      const snapshots = MemoryMonitor.getSnapshots();
      expect(snapshots).toHaveLength(100);
    });
  });

  describe('memory warnings', () => {
    it('triggers CRITICAL at >= 95% usage', async () => {
      // Advance past any lingering cooldown from singleton state
      jest.advanceTimersByTime(31_000);

      (getUsedMemory as jest.Mock).mockResolvedValue(960_000_000);
      (getTotalMemory as jest.Mock).mockResolvedValue(1_000_000_000);

      await MemoryMonitor.takeSnapshot('critical_test');

      expect(Telemetry.increment).toHaveBeenCalledWith(
        'app_memory_critical_total',
        1,
      );
    });

    it('respects 30s cooldown between warnings', async () => {
      // Set system time far enough from any previous test to clear the singleton's
      // persisted lastWarningTime (which cannot be reset externally).
      jest.setSystemTime(new Date('2026-06-01T00:00:00Z'));

      (getUsedMemory as jest.Mock).mockResolvedValue(960_000_000);
      (getTotalMemory as jest.Mock).mockResolvedValue(1_000_000_000);

      await MemoryMonitor.takeSnapshot('first_warning');
      expect(Telemetry.increment).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      // Take another snapshot immediately - should be within cooldown
      await MemoryMonitor.takeSnapshot('second_warning');
      expect(Telemetry.increment).not.toHaveBeenCalled();

      // Advance past cooldown (30 seconds)
      jest.advanceTimersByTime(31_000);
      jest.clearAllMocks();

      await MemoryMonitor.takeSnapshot('third_warning');
      expect(Telemetry.increment).toHaveBeenCalledWith(
        'app_memory_critical_total',
        1,
      );
    });
  });

  describe('getSnapshots', () => {
    it('returns a copy of snapshots', async () => {
      await MemoryMonitor.takeSnapshot('test');
      const first = MemoryMonitor.getSnapshots();
      const second = MemoryMonitor.getSnapshots();

      expect(first).toEqual(second);
      expect(first).not.toBe(second); // Different array references
    });
  });

  describe('getLatestSnapshot', () => {
    it('returns last snapshot or null', async () => {
      expect(MemoryMonitor.getLatestSnapshot()).toBeNull();

      await MemoryMonitor.takeSnapshot('first');
      await MemoryMonitor.takeSnapshot('second');

      const latest = MemoryMonitor.getLatestSnapshot();
      expect(latest).not.toBeNull();
      expect(latest!.context).toBe('second');
    });
  });

  describe('clearSnapshots', () => {
    it('empties the snapshots array', async () => {
      await MemoryMonitor.takeSnapshot('test');
      expect(MemoryMonitor.getSnapshots()).toHaveLength(1);

      MemoryMonitor.clearSnapshots();
      expect(MemoryMonitor.getSnapshots()).toHaveLength(0);
    });
  });

  describe('isEnabled', () => {
    it('reflects monitoring state', () => {
      expect(MemoryMonitor.isEnabled()).toBe(false);

      MemoryMonitor.start(10_000);
      expect(MemoryMonitor.isEnabled()).toBe(true);

      MemoryMonitor.stop();
      expect(MemoryMonitor.isEnabled()).toBe(false);
    });
  });
});
