import React from 'react';
import { render } from '@testing-library/react-native';

// Mock react-native-unistyles
jest.mock('react-native-unistyles', () => ({
  StyleSheet: {
    create: (styles: any) => styles,
  },
  useUnistyles: jest.fn(() => ({
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
      },
      spacing: { lg: 16, xs: 4 },
      fonts: { size: { '2xl': 24, sm: 12 }, weight: { bold: '700' } },
    },
  })),
}));

// Mock @shopify/react-native-skia
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  Group: 'Group',
  Path: 'Path',
  RoundedRect: 'RoundedRect',
  Circle: 'Circle',
  Skia: {
    Path: {
      Make: () => ({
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        quadTo: jest.fn().mockReturnThis(),
        close: jest.fn().mockReturnThis(),
      }),
    },
  },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  useSharedValue: jest.fn(() => ({ value: 0 })),
  useDerivedValue: jest.fn(() => []),
  withRepeat: jest.fn(),
  withSequence: jest.fn(),
  withTiming: jest.fn(),
  Easing: { bezier: jest.fn() },
}));

import { SplashScreen } from '../src/screens/SplashScreen';

describe('SplashScreen', () => {
  it('renders the splash screen', () => {
    const tree = render(<SplashScreen />);
    expect(tree).toMatchSnapshot();
  });

  it('is defined', () => {
    expect(SplashScreen).toBeDefined();
  });
});
