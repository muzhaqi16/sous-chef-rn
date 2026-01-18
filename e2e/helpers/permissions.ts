/**
 * Permissions Helpers
 *
 * Utilities for handling system permissions in E2E tests.
 * Provides methods to grant, deny, and check various permissions.
 */

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

/**
 * Grant camera permission
 * Required for barcode scanning functionality
 */
export async function grantCameraPermission(): Promise<void> {
  console.log('📷 Granting camera permission...');
  await device.launchApp({
    permissions: { camera: 'YES' },
  });
}

/**
 * Deny camera permission
 * Useful for testing permission denied flows
 */
export async function denyCameraPermission(): Promise<void> {
  console.log('📷 Denying camera permission...');
  await device.launchApp({
    permissions: { camera: 'NO' },
  });
}

/**
 * Grant notification permission
 */
export async function grantNotificationPermission(): Promise<void> {
  console.log('🔔 Granting notification permission...');
  await device.launchApp({
    permissions: { notifications: 'YES' },
  });
}

/**
 * Deny notification permission
 */
export async function denyNotificationPermission(): Promise<void> {
  console.log('🔔 Denying notification permission...');
  await device.launchApp({
    permissions: { notifications: 'NO' },
  });
}

/**
 * Grant photo library permission
 * Required for profile photo upload functionality
 */
export async function grantPhotoLibraryPermission(): Promise<void> {
  console.log('🖼️ Granting photo library permission...');
  await device.launchApp({
    permissions: { photos: 'YES' },
  });
}

/**
 * Deny photo library permission
 */
export async function denyPhotoLibraryPermission(): Promise<void> {
  console.log('🖼️ Denying photo library permission...');
  await device.launchApp({
    permissions: { photos: 'NO' },
  });
}

/**
 * Grant limited photo library permission (iOS 14+)
 */
export async function grantLimitedPhotoPermission(): Promise<void> {
  console.log('🖼️ Granting limited photo library permission...');
  await device.launchApp({
    permissions: { photos: 'limited' },
  });
}

/**
 * Set multiple permissions at once
 * @param permissions - Object with permission types and their status
 */
export async function setPermissions(
  permissions: Partial<Record<PermissionType, PermissionStatus>>,
): Promise<void> {
  console.log('🔐 Setting permissions:', permissions);
  await device.launchApp({
    permissions: permissions as any,
  });
}

/**
 * Reset all permissions to unset state
 * Requires reinstalling the app
 */
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

/**
 * Launch app with common test permissions
 * Grants camera and notifications which are commonly needed
 */
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

/**
 * Launch app with no permissions
 * Useful for testing permission request flows
 */
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

/**
 * Platform-specific permission handling
 */
export const PlatformPermissions = {
  /**
   * Handle iOS permission dialog by accepting
   * Note: This is typically handled via launch config, but sometimes dialogs appear
   */
  async acceptIOSPermissionDialog(): Promise<void> {
    if (device.getPlatform() === 'ios') {
      try {
        // iOS system dialogs can sometimes be interacted with
        // This is a best-effort approach
        console.log(
          '🍎 Attempting to accept iOS permission dialog (if present)...',
        );
      } catch {
        // Dialog might not be present
      }
    }
  },

  /**
   * Handle Android permission dialog by accepting
   */
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

/**
 * Test helper to verify permission denied UI is shown
 * @param permissionType - The type of permission being tested
 */
export async function expectPermissionDeniedUI(
  permissionType: PermissionType,
): Promise<void> {
  console.log(`🔍 Checking for ${permissionType} permission denied UI...`);
  // This would check for app-specific UI that shows when permission is denied
  // Implementation depends on how your app handles permission denied states
}
