/** Permissions are set through Detox launch config, not by tapping dialogs. */

import { device } from 'detox';

export type PermissionType =
  | 'camera'
  | 'photos'
  | 'notifications'
  | 'location'
  | 'microphone'
  | 'contacts'
  | 'calendar';

export type PermissionStatus = 'YES' | 'NO' | 'unset' | 'limited';

/** Required for barcode scanning. */
export async function grantCameraPermission(): Promise<void> {
  console.log('📷 Granting camera permission...');
  await device.launchApp({
    permissions: { camera: 'YES' },
  });
}

export async function denyCameraPermission(): Promise<void> {
  console.log('📷 Denying camera permission...');
  await device.launchApp({
    permissions: { camera: 'NO' },
  });
}

export async function grantNotificationPermission(): Promise<void> {
  console.log('🔔 Granting notification permission...');
  await device.launchApp({
    permissions: { notifications: 'YES' },
  });
}

export async function denyNotificationPermission(): Promise<void> {
  console.log('🔔 Denying notification permission...');
  await device.launchApp({
    permissions: { notifications: 'NO' },
  });
}

/** Required for profile photo upload. */
export async function grantPhotoLibraryPermission(): Promise<void> {
  console.log('🖼️ Granting photo library permission...');
  await device.launchApp({
    permissions: { photos: 'YES' },
  });
}

export async function denyPhotoLibraryPermission(): Promise<void> {
  console.log('🖼️ Denying photo library permission...');
  await device.launchApp({
    permissions: { photos: 'NO' },
  });
}

/** iOS 14+ only. */
export async function grantLimitedPhotoPermission(): Promise<void> {
  console.log('🖼️ Granting limited photo library permission...');
  await device.launchApp({
    permissions: { photos: 'limited' },
  });
}

export async function setPermissions(
  permissions: Partial<Record<PermissionType, PermissionStatus>>,
): Promise<void> {
  console.log('🔐 Setting permissions:', permissions);
  await device.launchApp({
    permissions: permissions as any,
  });
}

/** Reinstalls the app (`delete: true`) to reset permissions. */
export async function resetPermissions(): Promise<void> {
  console.log('🔄 Resetting all permissions...');
  await device.launchApp({
    delete: true,
    permissions: {
      camera: 'unset',
      notifications: 'unset',
      photos: 'unset',
    },
  });
}

export async function launchWithTestPermissions(): Promise<void> {
  console.log('🚀 Launching app with test permissions...');
  await device.launchApp({
    newInstance: true,
    permissions: {
      camera: 'YES',
      notifications: 'YES',
      photos: 'YES',
    },
  });
}

export async function launchWithNoPermissions(): Promise<void> {
  console.log('🚀 Launching app with no permissions...');
  await device.launchApp({
    delete: true,
    newInstance: true,
    permissions: {
      camera: 'NO',
      notifications: 'NO',
      photos: 'NO',
    },
  });
}

export const PlatformPermissions = {
  /** Stub: logs only — permissions are normally handled via launch config. */
  async acceptIOSPermissionDialog(): Promise<void> {
    if (device.getPlatform() === 'ios') {
      try {
        console.log(
          '🍎 Attempting to accept iOS permission dialog (if present)...',
        );
      } catch {
        // Dialog might not be present
      }
    }
  },

  /** Stub: logs only. */
  async acceptAndroidPermissionDialog(): Promise<void> {
    if (device.getPlatform() === 'android') {
      try {
        console.log(
          '🤖 Attempting to accept Android permission dialog (if present)...',
        );
      } catch {
        // Dialog might not be present
      }
    }
  },
};

/** Stub: asserts nothing yet — no denied-permission UI is pinned. */
export async function expectPermissionDeniedUI(
  permissionType: PermissionType,
): Promise<void> {
  console.log(`🔍 Checking for ${permissionType} permission denied UI...`);
}
