import { Platform } from 'react-native';

/**
 * The modality to NAME in copy, or null where the platform only guesses. iOS
 * reports its one sensor and Apple requires naming it. Android reports the
 * first sensor it FINDS, so a dual-sensor phone reads "Fingerprint" for a face
 * unlock — generic copy is the honest answer there.
 */
export const authoritativeBiometryName = (
  biometryType: string | null,
): string | null => (Platform.OS === 'ios' ? biometryType : null);
