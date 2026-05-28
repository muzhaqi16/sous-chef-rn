import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  PermissionService,
  type AppPermission,
  type PermissionStatus,
} from '#/services/permissions/PermissionService';

export function usePermission(permission: AppPermission) {
  const [status, setStatus] = useState<PermissionStatus>('undetermined');
  const [isChecking, setIsChecking] = useState(true);

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
    const check = async () => {
      const result = await PermissionService.check(permission);
      setStatus(result);
      setIsChecking(false);
    };
    check();
  }, [permission]);

  // Re-check when returning from settings
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        const check = async () => {
          const result = await PermissionService.check(permission);
          setStatus(result);
        };
        check();
      }
    });
    return () => subscription.remove();
  }, [permission]);

  return {
    status,
    isChecking,
    request: requestPermission,
    openSettings,
    isGranted: status === 'granted',
    isBlocked: status === 'blocked',
  };
}
