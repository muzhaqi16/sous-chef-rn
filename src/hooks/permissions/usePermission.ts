import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  PermissionService,
  type AppPermission,
  type PermissionStatus } from '#/services/permissions/PermissionService';

export function usePermission(permission: AppPermission) {
  const [status, setStatus] = useState<PermissionStatus>('undetermined');

  const checkPermission = async () => {
    const result = await PermissionService.check(permission);
    setStatus(result);
  };

  const requestPermission = async () => {
    const result = await PermissionService.request(permission);
    setStatus(result);
    return result;
  };

  const openSettings = () => {
    return PermissionService.openSettings();
  };

  // Check on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Re-check when returning from settings
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        checkPermission();
      }
    });
    return () => subscription.remove();
  }, [checkPermission]);

  return {
    status,
    request: requestPermission,
    openSettings,
    isGranted: status === 'granted',
    isBlocked: status === 'blocked' };
}
