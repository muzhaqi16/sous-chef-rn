import { registerSessionHost } from '#/services/auth/sessionHost';
import {
  forgetStoredSignIn,
  renewStoredSignIn,
  resolvePostSignInGate,
} from '#/services/biometric/deviceCredential';
import { registerDeviceInBackground } from '#/services/device/deviceRegistration';

/**
 * What a session does on this device beyond the core: register it for push
 * after a sign-in, offer biometric enrolment, drop the stored biometric sign-in
 * on a sign-out and renew it when a password change keeps the session. Each
 * step delegates through an arrow, so Metro's inline requires load the module
 * at the step's first run.
 */
export function registerMobileSessionHost(): void {
  registerSessionHost({
    afterSignIn: () => {
      requestIdleCallback(() => registerDeviceInBackground());
    },
    postSignInGate: (user, email, offerRememberMe, signInToken) =>
      resolvePostSignInGate(user, email, offerRememberMe, signInToken),
    forgetStoredSignIn: email => forgetStoredSignIn(email),
    renewStoredSignIn: email => renewStoredSignIn(email),
  });
}
