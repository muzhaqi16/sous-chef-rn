/**
 * Pins the Android error surface of the INSTALLED react-native-keychain, rather
 * than to our own copy of it.
 *
 * `keychain.ts` keeps a user's stored credentials on a biometric CANCEL and
 * discards them on a key the device refuses to unlock ever again. Android
 * delivers both as `E_CRYPTO_FAILED`, so the discriminator is a string in the
 * Kotlin — which no JS test can execute and no type can hold. Asserting
 * `isPermanentlyInvalidated(...) === false` on a fixture we wrote only compares
 * our constant to our constant: it would keep passing through an upgrade that
 * changed the format, and the failure mode of that drift is deleting a user's
 * credentials when they tap "Use manual login".
 *
 * Same intent as `wsCloseCodes.library.test.ts` and the probe scripts: keep the
 * claim falsifiable against whatever is in node_modules.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const ANDROID_SRC = join(
  __dirname,
  '../../../node_modules/react-native-keychain/android/src/main/java/com/oblador/keychain',
);

const read = (relative: string): string =>
  readFileSync(join(ANDROID_SRC, relative), 'utf8');

describe('react-native-keychain Android error surface', () => {
  it('formats every biometric prompt outcome with the code marker', () => {
    const handler = read('resultHandler/ResultHandlerInteractiveBiometric.kt');

    // onAuthenticationError is androidx's single callback for cancel,
    // negative-button, timeout, lockout and hardware faults alike.
    expect(handler).toContain('override fun onAuthenticationError(');
    expect(handler).toContain(
      'CryptoFailedException("code: $errorCode, msg: $errString")',
    );
  });

  it('rejects every CryptoFailedException with the same code', () => {
    const module = read('KeychainModule.kt');

    expect(module).toContain('const val E_CRYPTO_FAILED = "E_CRYPTO_FAILED"');
    expect(module).toMatch(
      /catch \(e: CryptoFailedException\)[\s\S]{0,160}promise\.reject\(\s*Errors\.E_CRYPTO_FAILED/,
    );
  });

  it('has no separate code for a permanently invalidated key', () => {
    const module = read('KeychainModule.kt');

    // If the library ever adds one, prefer it over the message marker.
    expect(module).not.toContain('E_KEY_PERMANENTLY_INVALIDATED');
  });
});
