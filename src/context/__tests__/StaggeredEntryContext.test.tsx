import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { renderHook, act } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import {
  StaggeredEntryProvider,
  useStaggeredEntry,
} from '../StaggeredEntryContext';

describe('StaggeredEntryContext', () => {
  describe('StaggeredEntryProvider', () => {
    it('renders children', () => {
      render(
        <StaggeredEntryProvider>
          <Text>Staggered Content</Text>
        </StaggeredEntryProvider>,
      );
      expect(screen.getByText('Staggered Content')).toBeTruthy();
    });
  });

  describe('useStaggeredEntry', () => {
    it('returns null when used outside provider', () => {
      const { result } = renderHook(() => useStaggeredEntry());
      expect(result.current).toBeNull();
    });

    it('returns context value when inside provider', () => {
      const { result } = renderHook(() => useStaggeredEntry(), {
        wrapper: ({ children }) => (
          <StaggeredEntryProvider>{children}</StaggeredEntryProvider>
        ),
      });
      expect(result.current).not.toBeNull();
      expect(typeof result.current!.getEntryDelay).toBe('function');
      expect(typeof result.current!.markInitialRenderComplete).toBe('function');
    });
  });

  describe('getEntryDelay', () => {
    it('returns a delay based on index during initial render', () => {
      const { result } = renderHook(() => useStaggeredEntry(), {
        wrapper: ({ children }) => (
          <StaggeredEntryProvider>{children}</StaggeredEntryProvider>
        ),
      });

      // staggeredEntryAnimation: { delayPerItem: 0, maxItems: 6, initialDelay: 30 }
      // delay = initialDelay + min(index, maxItems) * delayPerItem
      // With delayPerItem = 0, delay is always initialDelay (30) for all indices
      const delay0 = result.current!.getEntryDelay(0);
      const delay1 = result.current!.getEntryDelay(1);
      const delay5 = result.current!.getEntryDelay(5);

      expect(delay0).toBe(30); // initialDelay + 0 * 0
      expect(delay1).toBe(30); // initialDelay + 1 * 0
      expect(delay5).toBe(30); // initialDelay + 5 * 0
    });

    it('returns 0 after markInitialRenderComplete is called', () => {
      const { result } = renderHook(() => useStaggeredEntry(), {
        wrapper: ({ children }) => (
          <StaggeredEntryProvider>{children}</StaggeredEntryProvider>
        ),
      });

      // Before marking complete
      expect(result.current!.getEntryDelay(0)).toBeGreaterThan(0);

      // Mark initial render complete
      act(() => {
        result.current!.markInitialRenderComplete();
      });

      // After marking complete, delay should be 0
      expect(result.current!.getEntryDelay(0)).toBe(0);
      expect(result.current!.getEntryDelay(5)).toBe(0);
    });
  });
});
