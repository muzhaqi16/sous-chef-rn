import React from 'react';
import { render } from '@testing-library/react-native';
import SplashScreen from '../src/screens/SplashScreen';

describe('SplashScreen', () => {
  it('renders the splash screen', () => {
    const tree = render(<SplashScreen />);
    expect(tree).toMatchSnapshot();
  });
});