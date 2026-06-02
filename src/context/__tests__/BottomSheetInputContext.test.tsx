import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { renderHook } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import {
  BottomSheetInputProvider,
  useIsBottomSheetInput,
} from '../BottomSheetInputContext';

describe('BottomSheetInputContext', () => {
  describe('useIsBottomSheetInput', () => {
    it('returns false by default (outside provider)', () => {
      const { result } = renderHook(() => useIsBottomSheetInput());
      expect(result.current).toBe(false);
    });

    it('returns false when provider value is false', () => {
      const { result } = renderHook(() => useIsBottomSheetInput(), {
        wrapper: ({ children }) => (
          <BottomSheetInputProvider value={false}>
            {children}
          </BottomSheetInputProvider>
        ),
      });
      expect(result.current).toBe(false);
    });

    it('returns true when provider value is true', () => {
      const { result } = renderHook(() => useIsBottomSheetInput(), {
        wrapper: ({ children }) => (
          <BottomSheetInputProvider value={true}>
            {children}
          </BottomSheetInputProvider>
        ),
      });
      expect(result.current).toBe(true);
    });
  });

  describe('BottomSheetInputProvider', () => {
    it('renders children', () => {
      render(
        <BottomSheetInputProvider value={false}>
          <Text>Child Content</Text>
        </BottomSheetInputProvider>,
      );
      expect(screen.getByText('Child Content')).toBeTruthy();
    });
  });
});
