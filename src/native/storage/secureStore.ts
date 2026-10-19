import type { SecureStore } from '#platform/ports';
import {
  addPendingRevocation,
  clearSessionTokens,
  loadDeviceId,
  loadPendingRevocations,
  loadSessionTokens,
  removePendingRevocation,
  saveDeviceId,
  saveSessionTokens,
} from './keychain';

/**
 * The secure store over the OS keychain. Each member delegates through an
 * arrow, so Metro's inline requires load the keychain at its first use.
 */
export const keychainSecureStore: SecureStore = {
  saveSessionTokens: tokens => saveSessionTokens(tokens),
  loadSessionTokens: () => loadSessionTokens(),
  clearSessionTokens: () => clearSessionTokens(),
  saveDeviceId: deviceId => saveDeviceId(deviceId),
  loadDeviceId: () => loadDeviceId(),
  addPendingRevocation: revocation => addPendingRevocation(revocation),
  loadPendingRevocations: () => loadPendingRevocations(),
  removePendingRevocation: refreshToken =>
    removePendingRevocation(refreshToken),
};
