import { useEffect, useState } from 'react';
import { PermissionService } from '#/services/permissions/PermissionService';

export const useNotificationPermissions = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const requestPermissions = async (): Promise<boolean> => {
    const status = await PermissionService.request('notifications');
    const granted = status === 'granted';
    setHasPermission(granted);
    return granted;
  };

  const checkPermissions = async () => {
    const status = await PermissionService.check('notifications');
    setHasPermission(status === 'granted');
  };

  useEffect(() => {
    const check = async () => {
      const status = await PermissionService.check('notifications');
      setHasPermission(status === 'granted');
    };
    check();
  }, []);

  return {
    hasPermission,
    requestPermissions,
    checkPermissions,
  };
};
