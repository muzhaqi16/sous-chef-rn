// Mock tokenScheduler and refreshToken to break circular dependency chain
// (same pattern used by store slice tests)
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

import { HapticFeedbackType, HapticService } from '../HapticService';
import { Vibration } from 'react-native';

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
    it('triggers vibration for feedback type', () => {
      HapticService.trigger(HapticFeedbackType.LIGHT);
      expect(Vibration.vibrate).toHaveBeenCalled();
    });

    it('does not trigger when disabled', () => {
      HapticService.setEnabled(false);
      HapticService.trigger(HapticFeedbackType.LIGHT);
      expect(Vibration.vibrate).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('cancels vibration', () => {
      HapticService.cancel();
      expect(Vibration.cancel).toHaveBeenCalled();
    });
  });

  describe('convenience methods', () => {
    it('light triggers LIGHT feedback', () => {
      HapticService.light();
      expect(Vibration.vibrate).toHaveBeenCalled();
    });

    it('medium triggers MEDIUM feedback', () => {
      HapticService.medium();
      expect(Vibration.vibrate).toHaveBeenCalled();
    });

    it('success triggers SUCCESS feedback', () => {
      HapticService.success();
      expect(Vibration.vibrate).toHaveBeenCalled();
    });

    it('warning triggers WARNING feedback', () => {
      HapticService.warning();
      expect(Vibration.vibrate).toHaveBeenCalled();
    });

    it('error triggers ERROR feedback', () => {
      HapticService.error();
      expect(Vibration.vibrate).toHaveBeenCalled();
    });

    it('selection triggers SELECTION feedback', () => {
      HapticService.selection();
      expect(Vibration.vibrate).toHaveBeenCalled();
    });
  });
});
