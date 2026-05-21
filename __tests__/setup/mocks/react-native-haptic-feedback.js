'use no memo';
jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
  stop: jest.fn(),
  isSupported: jest.fn(() => true),
  setEnabled: jest.fn(),
  isEnabled: jest.fn(() => true),
  HapticFeedbackTypes: {
    selection: 'selection',
    impactLight: 'impactLight',
    impactMedium: 'impactMedium',
    impactHeavy: 'impactHeavy',
    rigid: 'rigid',
    soft: 'soft',
    notificationSuccess: 'notificationSuccess',
    notificationWarning: 'notificationWarning',
    notificationError: 'notificationError',
    longPress: 'longPress',
  },
}));
