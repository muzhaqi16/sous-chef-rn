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

// Labelling took 4–8 s for ten lines on the simulator; a long receipt on an
// older phone takes longer. Set from device runs (tasks 5.1).
export const LABELLING_TIMEOUT_MS = 20_000;
