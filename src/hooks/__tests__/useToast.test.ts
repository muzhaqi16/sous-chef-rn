import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { useToast, ToastContext } from '../useToast';

describe('useToast', () => {
  it('returns default no-op function when no provider', () => {
    const { result } = renderHook(() => useToast());

    expect(typeof result.current).toBe('function');
    // Calling the default should not throw
    result.current('test message' as any);
  });

  it('returns the toast function from context provider', () => {
    const mockToastFn = jest.fn();

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(ToastContext.Provider, { value: mockToastFn }, children);

    const { result } = renderHook(() => useToast(), { wrapper });

    expect(result.current).toBe(mockToastFn);
  });
});
