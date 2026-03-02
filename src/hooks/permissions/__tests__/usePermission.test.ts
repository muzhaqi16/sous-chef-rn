'use no memo';

jest.mock('#/services/permissions/PermissionService', () => ({
  PermissionService: {
    check: jest.fn().mockResolvedValue('granted'),
    request: jest.fn().mockResolvedValue('granted'),
    openSettings: jest.fn().mockResolvedValue(undefined),
  },
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePermission } from '../usePermission';
import { PermissionService } from '#/services/permissions/PermissionService';

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
      ({ perm }: { perm: any }) => usePermission(perm),
      { initialProps: { perm: 'camera' as any } },
    );

    await waitFor(() => {
      expect(result.current.status).toBe('granted');
    });

    rerender({ perm: 'photos' as any });

    await waitFor(() => {
      expect(PermissionService.check).toHaveBeenCalledWith('photos');
    });
  });
});
