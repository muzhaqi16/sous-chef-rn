import React from 'react';
import { render } from '@testing-library/react-native';

// Mock react-native-unistyles before importing SplashScreen
jest.mock('react-native-unistyles', () => ({
  StyleSheet: {
    create: (styles: any) => styles,
  },
  UnistylesRegistry: {
    addThemes: jest.fn(),
  },
  useStyles: jest.fn(() => ({ styles: {}, theme: {} })),
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
