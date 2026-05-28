// Mock tokenScheduler and refreshToken to break circular dependency chain
// (same pattern used by store slice tests)
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockTrigger = jest.fn();
jest.mock('react-native-haptic-feedback', () => ({
  trigger: (...args: unknown[]) => mockTrigger(...args),
  HapticFeedbackTypes: {
    impactLight: 'impactLight',
    impactMedium: 'impactMedium',
    impactHeavy: 'impactHeavy',
    notificationSuccess: 'notificationSuccess',
    notificationWarning: 'notificationWarning',
    notificationError: 'notificationError',
    selection: 'selection',
    longPress: 'longPress',
  },
}));

import { HapticFeedbackType, HapticService } from '../HapticService';

describe('HapticService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    HapticService.setEnabled(true);
  });

  describe('setEnabled / isEnabled', () => {
    it('enables haptics', () => {
      HapticService.setEnabled(true);
      expect(HapticService.isEnabled()).toBe(true);
    });

    it('disables haptics', () => {
      HapticService.setEnabled(false);
      expect(HapticService.isEnabled()).toBe(false);
    });
  });

  describe('isSupported', () => {
    it('returns true for iOS', () => {
      expect(HapticService.isSupported()).toBe(true);
    });
  });

  describe('trigger', () => {
    it('triggers native haptic for feedback type', () => {
      HapticService.trigger(HapticFeedbackType.LIGHT);
      expect(mockTrigger).toHaveBeenCalledWith(
        'impactLight',
        expect.any(Object),
      );
    });

    it('does not trigger when disabled', () => {
      HapticService.setEnabled(false);
      HapticService.trigger(HapticFeedbackType.LIGHT);
      expect(mockTrigger).not.toHaveBeenCalled();
    });
  });

  describe('convenience methods', () => {
    it('light triggers impactLight', () => {
      HapticService.light();
      expect(mockTrigger).toHaveBeenCalledWith(
        'impactLight',
        expect.any(Object),
      );
    });

    it('medium triggers impactMedium', () => {
      HapticService.medium();
      expect(mockTrigger).toHaveBeenCalledWith(
        'impactMedium',
        expect.any(Object),
      );
    });

    it('success triggers notificationSuccess', () => {
      HapticService.success();
      expect(mockTrigger).toHaveBeenCalledWith(
        'notificationSuccess',
        expect.any(Object),
      );
    });

    it('warning triggers notificationWarning', () => {
      HapticService.warning();
      expect(mockTrigger).toHaveBeenCalledWith(
        'notificationWarning',
        expect.any(Object),
      );
    });

    it('error triggers notificationError', () => {
      HapticService.error();
      expect(mockTrigger).toHaveBeenCalledWith(
        'notificationError',
        expect.any(Object),
      );
    });

    it('selection triggers selection', () => {
      HapticService.selection();
      expect(mockTrigger).toHaveBeenCalledWith('selection', expect.any(Object));
    });
  });
});
