import React from 'react';
import { render } from '@testing-library/react-native';
import { SplashScreen } from '../src/screens/SplashScreen';

describe('SplashScreen', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(<SplashScreen />);
    expect(getByTestId('splash-screen')).toBeTruthy();
  });

  it('is defined', () => {
    expect(SplashScreen).toBeDefined();
  });
});
