import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { renderHook, act } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import {
  ListAnimationProvider,
  useListAnimation,
  useListAnimationOptional,
} from '../ListAnimationContext';

describe('ListAnimationContext', () => {
  describe('ListAnimationProvider', () => {
    it('renders children', () => {
      render(
        <ListAnimationProvider>
          <Text>Animated List</Text>
        </ListAnimationProvider>,
      );
      expect(screen.getByText('Animated List')).toBeTruthy();
    });
  });

  describe('useListAnimation', () => {
    it('throws when used outside provider', () => {
      expect(() => {
        renderHook(() => useListAnimation());
      }).toThrow(
        'useListAnimation must be used within a ListAnimationProvider',
      );
    });

    it('returns context value when inside provider', () => {
      const { result } = renderHook(() => useListAnimation(), {
        wrapper: ({ children }) => (
          <ListAnimationProvider>{children}</ListAnimationProvider>
        ),
      });
      expect(result.current).toBeDefined();
      expect(typeof result.current.registerAnimationTrigger).toBe('function');
      expect(typeof result.current.unregisterAnimationTrigger).toBe('function');
      expect(typeof result.current.scheduleAnimation).toBe('function');
      expect(typeof result.current.scheduleEntryAnimation).toBe('function');
      expect(typeof result.current.claimEntryAnimation).toBe('function');
    });
  });

  describe('useListAnimationOptional', () => {
    it('returns null when used outside provider', () => {
      const { result } = renderHook(() => useListAnimationOptional());
      expect(result.current).toBeNull();
    });

    it('returns context value when inside provider', () => {
      const { result } = renderHook(() => useListAnimationOptional(), {
        wrapper: ({ children }) => (
          <ListAnimationProvider>{children}</ListAnimationProvider>
        ),
      });
      expect(result.current).not.toBeNull();
      expect(typeof result.current!.scheduleAnimation).toBe('function');
    });
  });

  describe('registerAnimationTrigger / unregisterAnimationTrigger', () => {
    it('registers and unregisters a trigger', () => {
      const { result } = renderHook(() => useListAnimation(), {
        wrapper: ({ children }) => (
          <ListAnimationProvider>{children}</ListAnimationProvider>
        ),
      });

      const trigger = jest.fn();
      act(() => {
        result.current.registerAnimationTrigger('item-1', trigger);
      });

      // Trigger should be callable via scheduleAnimation
      const onComplete = jest.fn();
      act(() => {
        result.current.scheduleAnimation('item-1', 1, onComplete);
      });
      expect(trigger).toHaveBeenCalledWith(1, onComplete);

      // After unregistering, trigger should not be called again
      trigger.mockClear();
      act(() => {
        result.current.unregisterAnimationTrigger('item-1');
      });
    });
  });

  describe('scheduleAnimation', () => {
    it('calls trigger directly when item is registered', () => {
      const { result } = renderHook(() => useListAnimation(), {
        wrapper: ({ children }) => (
          <ListAnimationProvider>{children}</ListAnimationProvider>
        ),
      });

      const trigger = jest.fn();
      const onComplete = jest.fn();

      act(() => {
        result.current.registerAnimationTrigger('item-1', trigger);
        result.current.scheduleAnimation('item-1', -1, onComplete);
      });

      expect(trigger).toHaveBeenCalledWith(-1, onComplete);
    });

    it('deduplicates pending animations for same item', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useListAnimation(), {
        wrapper: ({ children }) => (
          <ListAnimationProvider>{children}</ListAnimationProvider>
        ),
      });

      const onComplete1 = jest.fn();
      const onComplete2 = jest.fn();

      act(() => {
        // No trigger registered, so falls back to timeout
        result.current.scheduleAnimation('item-x', 1, onComplete1);
        result.current.scheduleAnimation('item-x', 1, onComplete2);
      });

      // Only the first should be queued
      act(() => {
        jest.advanceTimersByTime(600);
      });
      expect(onComplete1).toHaveBeenCalled();
      expect(onComplete2).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('falls back to timeout when item is not registered', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useListAnimation(), {
        wrapper: ({ children }) => (
          <ListAnimationProvider>{children}</ListAnimationProvider>
        ),
      });

      const onComplete = jest.fn();

      act(() => {
        result.current.scheduleAnimation('unregistered-item', 1, onComplete);
      });

      expect(onComplete).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(onComplete).toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('scheduleEntryAnimation / claimEntryAnimation', () => {
    it('schedules and claims an entry animation', () => {
      const { result } = renderHook(() => useListAnimation(), {
        wrapper: ({ children }) => (
          <ListAnimationProvider>{children}</ListAnimationProvider>
        ),
      });

      act(() => {
        result.current.scheduleEntryAnimation('item-1', 1);
      });

      let claimed!: ReturnType<
        ReturnType<typeof useListAnimation>['claimEntryAnimation']
      >;
      act(() => {
        claimed = result.current.claimEntryAnimation('item-1');
      });

      expect(claimed).toEqual({ itemId: 'item-1', direction: 1 });
    });

    it('returns undefined when no entry animation is pending', () => {
      const { result } = renderHook(() => useListAnimation(), {
        wrapper: ({ children }) => (
          <ListAnimationProvider>{children}</ListAnimationProvider>
        ),
      });

      let claimed!: ReturnType<
        ReturnType<typeof useListAnimation>['claimEntryAnimation']
      >;
      act(() => {
        claimed = result.current.claimEntryAnimation('nonexistent');
      });

      expect(claimed).toBeUndefined();
    });

    it('entry animation expires after timeout', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useListAnimation(), {
        wrapper: ({ children }) => (
          <ListAnimationProvider>{children}</ListAnimationProvider>
        ),
      });

      act(() => {
        result.current.scheduleEntryAnimation('item-1', -1);
      });

      act(() => {
        jest.advanceTimersByTime(1100);
      });

      let claimed!: ReturnType<
        ReturnType<typeof useListAnimation>['claimEntryAnimation']
      >;
      act(() => {
        claimed = result.current.claimEntryAnimation('item-1');
      });

      expect(claimed).toBeUndefined();
      jest.useRealTimers();
    });

    it('claiming clears the expiry timeout', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useListAnimation(), {
        wrapper: ({ children }) => (
          <ListAnimationProvider>{children}</ListAnimationProvider>
        ),
      });

      act(() => {
        result.current.scheduleEntryAnimation('item-1', 1);
      });

      let claimed!: ReturnType<
        ReturnType<typeof useListAnimation>['claimEntryAnimation']
      >;
      act(() => {
        claimed = result.current.claimEntryAnimation('item-1');
      });
      expect(claimed).toBeDefined();

      // Claiming again should return undefined (already consumed)
      act(() => {
        claimed = result.current.claimEntryAnimation('item-1');
      });
      expect(claimed).toBeUndefined();

      jest.useRealTimers();
    });
  });
});
