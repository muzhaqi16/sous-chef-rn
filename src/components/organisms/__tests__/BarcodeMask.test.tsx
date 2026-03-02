'use no memo';
import React from 'react';
import { render } from '@testing-library/react-native';
import BarcodeMask from '../BarcodeMask';

jest.mock('#/apollo/links/tokenScheduler', () => ({ scheduleTokenRefresh: jest.fn(), cancelScheduledRefresh: jest.fn() }));
jest.mock('#/apollo/links/refreshToken', () => ({ refreshAccessToken: jest.fn() }));
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Defs: View,
    Rect: View,
    Mask: View,
  };
});
jest.mock('#components/molecules/AnimatedScanLine', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});

describe('BarcodeMask', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<BarcodeMask />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom dimensions', () => {
    const { toJSON } = render(<BarcodeMask width={300} height={250} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders without animated line when disabled', () => {
    const { toJSON } = render(<BarcodeMask showAnimatedLine={false} />);
    expect(toJSON()).toBeTruthy();
  });
});
