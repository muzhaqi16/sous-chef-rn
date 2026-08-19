'use no memo';

jest.mock('#/services/permissions/PermissionService', () => ({
  PermissionService: {
    check: jest.fn().mockResolvedValue('granted'),
    request: jest.fn().mockResolvedValue('granted'),
    openSettings: jest.fn().mockResolvedValue(undefined),
  },
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { usePermission } from '../usePermission';
import {
  PermissionService,
  type AppPermission,
} from '#/services/permissions/PermissionService';

/**
 * The RN jest mock leaves `AppState.addEventListener` as a jest.fn returning a
 * subscription, so the registered listener can be driven directly.
 *
 * The mock's `remove()` does not unregister anything, so a listener the hook
 * has already torn down stays callable here. Reading the *most recent* 'change'
 * call is what keeps this driver honest: that is the only listener still
 * subscribed in production. Locating it by index keeps it in step with the
 * subscription it returned.
 */
function findAppStateChangeCall() {
  const mock = AppState.addEventListener as jest.Mock;
  const index = mock.mock.calls.reduce(
    (last, [event], i) => (event === 'change' ? i : last),
    -1,
  );
  if (index === -1) {
    throw new Error('usePermission did not subscribe to AppState "change"');
  }
  return {
    notify: mock.mock.calls[index][1] as (state: AppStateStatus) => void,
    subscription: mock.mock.results[index].value as { remove: jest.Mock },
  };
}

describe('usePermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (PermissionService.check as jest.Mock).mockResolvedValue('granted');
    (PermissionService.request as jest.Mock).mockResolvedValue('granted');
  });

  it('starts with undetermined status', () => {
    const { result } = renderHook(() => usePermission('camera'));

    // Initial state before async check resolves
    expect(result.current.status).toBe('undetermined');
  });

  it('checks permission on mount', async () => {
    renderHook(() => usePermission('camera'));

    await waitFor(() => {
      expect(PermissionService.check).toHaveBeenCalledWith('camera');
    });
  });

  it('updates status after check resolves', async () => {
    (PermissionService.check as jest.Mock).mockResolvedValue('granted');

    const { result } = renderHook(() => usePermission('camera'));

    await waitFor(() => {
      expect(result.current.status).toBe('granted');
      expect(result.current.isGranted).toBe(true);
    });
  });

  it('isBlocked is true when status is blocked', async () => {
    (PermissionService.check as jest.Mock).mockResolvedValue('blocked');

    const { result } = renderHook(() => usePermission('camera'));

    await waitFor(() => {
      expect(result.current.isBlocked).toBe(true);
      expect(result.current.isGranted).toBe(false);
    });
  });

  it('request calls PermissionService.request and updates status', async () => {
    (PermissionService.check as jest.Mock).mockResolvedValue('denied');
    (PermissionService.request as jest.Mock).mockResolvedValue('granted');

    const { result } = renderHook(() => usePermission('camera'));

    await waitFor(() => {
      expect(result.current.status).toBe('denied');
    });

    await act(async () => {
      const requestResult = await result.current.request();
      expect(requestResult).toBe('granted');
    });

    expect(PermissionService.request).toHaveBeenCalledWith('camera');
  });

  it('openSettings calls PermissionService.openSettings', async () => {
    const { result } = renderHook(() => usePermission('camera'));

    act(() => {
      result.current.openSettings();
    });

    expect(PermissionService.openSettings).toHaveBeenCalled();
  });

  it('re-checks permission when permission parameter changes', async () => {
    (PermissionService.check as jest.Mock)
      .mockResolvedValueOnce('granted')
      .mockResolvedValueOnce('denied');

    const { result, rerender } = renderHook(
      ({ perm }: { perm: AppPermission }) => usePermission(perm),
      { initialProps: { perm: 'camera' } },
    );

    await waitFor(() => {
      expect(result.current.status).toBe('granted');
    });

    rerender({ perm: 'photos' as AppPermission });

    await waitFor(() => {
      expect(PermissionService.check).toHaveBeenCalledWith('photos');
    });
  });

  it('re-checks the permission when the app returns to the foreground', async () => {
    (PermissionService.check as jest.Mock).mockResolvedValue('blocked');

    const { result } = renderHook(() => usePermission('camera'));

    await waitFor(() => {
      expect(result.current.isBlocked).toBe(true);
    });

    // The person grants the permission in system settings and comes back.
    (PermissionService.check as jest.Mock)
      .mockClear()
      .mockResolvedValue('granted');
    const { notify } = findAppStateChangeCall();

    await act(async () => {
      notify('active');
    });

    expect(PermissionService.check).toHaveBeenCalledWith('camera');
    await waitFor(() => {
      expect(result.current.status).toBe('granted');
      expect(result.current.isGranted).toBe(true);
    });
  });

  it('does not re-check while the app is leaving the foreground', async () => {
    const { result } = renderHook(() => usePermission('camera'));

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    (PermissionService.check as jest.Mock).mockClear();
    const { notify } = findAppStateChangeCall();

    await act(async () => {
      notify('background');
      notify('inactive');
    });

    expect(PermissionService.check).not.toHaveBeenCalled();
  });

  it('re-checks the newly requested permission after a permission change', async () => {
    (PermissionService.check as jest.Mock).mockResolvedValue('denied');

    const { result, rerender } = renderHook(
      ({ perm }: { perm: AppPermission }) => usePermission(perm),
      { initialProps: { perm: 'camera' } },
    );

    await waitFor(() => {
      expect(result.current.status).toBe('denied');
    });

    rerender({ perm: 'photos' as AppPermission });

    await waitFor(() => {
      expect(PermissionService.check).toHaveBeenCalledWith('photos');
    });

    (PermissionService.check as jest.Mock).mockClear();
    const { notify } = findAppStateChangeCall();

    await act(async () => {
      notify('active');
    });

    expect(PermissionService.check).toHaveBeenCalledWith('photos');
    expect(PermissionService.check).not.toHaveBeenCalledWith('camera');
  });

  it('tears down the AppState subscription on unmount', async () => {
    const { result, unmount } = renderHook(() => usePermission('camera'));

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    const { subscription } = findAppStateChangeCall();
    unmount();

    expect(subscription.remove).toHaveBeenCalled();
  });
});
