'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import ReusableBottomSheet from '../BottomSheet';

jest.mock('#components/atoms/GlobalBottomSheetBackdrop', () => {
  const RN = require('react-native');
  return {
    GlobalBottomSheetBackdrop: (props: any) =>
      require('react').createElement(RN.View, { testID: 'backdrop', ...props }),
  };
});

describe('ReusableBottomSheet', () => {
  it('renders children content', () => {
    render(
      <ReusableBottomSheet>
        <Text>Sheet Content</Text>
      </ReusableBottomSheet>,
    );
    expect(screen.getByText('Sheet Content')).toBeTruthy();
  });

  it('renders with default snap points', () => {
    const { toJSON } = render(
      <ReusableBottomSheet>
        <Text>Default Snaps</Text>
      </ReusableBottomSheet>,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom snap points', () => {
    const { toJSON } = render(
      <ReusableBottomSheet snapPoints={['50%', '90%']}>
        <Text>Custom Snaps</Text>
      </ReusableBottomSheet>,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('exposes expand and close methods via ref', () => {
    const ref = React.createRef<any>();
    render(
      <ReusableBottomSheet ref={ref}>
        <Text>Ref Test</Text>
      </ReusableBottomSheet>,
    );
    expect(ref.current).toBeTruthy();
    expect(typeof ref.current.expand).toBe('function');
    expect(typeof ref.current.close).toBe('function');
  });

  it('does not crash when calling expand on ref', () => {
    const ref = React.createRef<any>();
    render(
      <ReusableBottomSheet ref={ref}>
        <Text>Expand Test</Text>
      </ReusableBottomSheet>,
    );
    expect(() => ref.current.expand()).not.toThrow();
  });

  it('does not crash when calling close on ref', () => {
    const ref = React.createRef<any>();
    render(
      <ReusableBottomSheet ref={ref}>
        <Text>Close Test</Text>
      </ReusableBottomSheet>,
    );
    expect(() => ref.current.close()).not.toThrow();
  });

  it('renders multiple children', () => {
    render(
      <ReusableBottomSheet>
        <Text>First Child</Text>
        <Text>Second Child</Text>
      </ReusableBottomSheet>,
    );
    expect(screen.getByText('First Child')).toBeTruthy();
    expect(screen.getByText('Second Child')).toBeTruthy();
  });
});
