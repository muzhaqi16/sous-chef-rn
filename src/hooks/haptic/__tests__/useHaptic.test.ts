'use no memo';

// Mock tokenScheduler and refreshToken to break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

import { renderHook } from '@testing-library/react-native';
import { useHaptic } from '../useHaptic';
import { HapticService, HapticFeedbackType } from '#services/haptic/HapticService';

describe('useHaptic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all expected methods and properties', () => {
    const { result } = renderHook(() => useHaptic());
    expect(result.current).toHaveProperty('trigger');
    expect(result.current).toHaveProperty('light');
    expect(result.current).toHaveProperty('medium');
    expect(result.current).toHaveProperty('heavy');
    expect(result.current).toHaveProperty('success');
    expect(result.current).toHaveProperty('warning');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('selection');
    expect(result.current).toHaveProperty('longPress');
    expect(result.current).toHaveProperty('cancel');
    expect(result.current).toHaveProperty('isEnabled');
    expect(result.current).toHaveProperty('isSupported');
  });

  it('calls HapticService.trigger when trigger is called', () => {
    const spy = jest.spyOn(HapticService, 'trigger');
    const { result } = renderHook(() => useHaptic());

    result.current.trigger(HapticFeedbackType.LIGHT);
    expect(spy).toHaveBeenCalledWith(HapticFeedbackType.LIGHT);
  });

  it('calls HapticService.light when light is called', () => {
    const spy = jest.spyOn(HapticService, 'light');
    const { result } = renderHook(() => useHaptic());

    result.current.light();
    expect(spy).toHaveBeenCalled();
  });

  it('calls HapticService.medium when medium is called', () => {
    const spy = jest.spyOn(HapticService, 'medium');
    const { result } = renderHook(() => useHaptic());

    result.current.medium();
    expect(spy).toHaveBeenCalled();
  });

  it('calls HapticService.heavy when heavy is called', () => {
    const spy = jest.spyOn(HapticService, 'heavy');
    const { result } = renderHook(() => useHaptic());

    result.current.heavy();
    expect(spy).toHaveBeenCalled();
  });

  it('calls HapticService.success when success is called', () => {
    const spy = jest.spyOn(HapticService, 'success');
    const { result } = renderHook(() => useHaptic());

    result.current.success();
    expect(spy).toHaveBeenCalled();
  });

  it('calls HapticService.warning when warning is called', () => {
    const spy = jest.spyOn(HapticService, 'warning');
    const { result } = renderHook(() => useHaptic());

    result.current.warning();
    expect(spy).toHaveBeenCalled();
  });

  it('calls HapticService.cancel when cancel is called', () => {
    const spy = jest.spyOn(HapticService, 'cancel');
    const { result } = renderHook(() => useHaptic());

    result.current.cancel();
    expect(spy).toHaveBeenCalled();
  });
});
