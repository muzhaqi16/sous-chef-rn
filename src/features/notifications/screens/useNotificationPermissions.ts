import { useEffect, useState } from 'react';
import { PermissionService } from '#/services/permissions/PermissionService';
import { logger } from '#/utils/environment';

export const useNotificationPermissions = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const requestPermissions = async (): Promise<boolean> => {
    const status = await PermissionService.request('notifications');
    const granted = status === 'granted';
    setHasPermission(granted);
    return granted;
  };

  /** Returns the resolved grant so a caller can act on a just-made grant. */
  const checkPermissions = async (): Promise<boolean> => {
    const status = await PermissionService.check('notifications');
    const granted = status === 'granted';
    setHasPermission(granted);
    return granted;
  };

  useEffect(() => {
    const check = async () => {
      const status = await PermissionService.check('notifications');
      setHasPermission(status === 'granted');
    };
    void check().catch(error =>
      logger.warn('Notification permission check failed', error),
    );
  }, []);

  return {
    hasPermission,
    requestPermissions,
    checkPermissions,
  };
};
