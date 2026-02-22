import { useCallback, useEffect, useState } from 'react';
import { PermissionService } from '#/services/permissions/PermissionService';

export const useNotificationPermissions = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const checkPermissions = useCallback(async () => {
    const status = await PermissionService.check('notifications');
    setHasPermission(status === 'granted');
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const status = await PermissionService.request('notifications');
    const granted = status === 'granted';
    setHasPermission(granted);
    return granted;
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  return {
    hasPermission,
    requestPermissions,
    checkPermissions,
  };
};
