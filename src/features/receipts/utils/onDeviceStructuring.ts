import type { PlatformOSType } from 'react-native';

/**
 * Where the phone's own model structures a receipt. Each platform stays off
 * until its model passes the corpus evaluation on a device
 * (`on-device-receipt-recognition` design D6); until then the server reads it.
 */
export const onDeviceStructuring: Partial<Record<PlatformOSType, boolean>> = {
  ios: false,
  android: false,
};
