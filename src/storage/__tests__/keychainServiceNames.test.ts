import {
  CREDENTIALS_INDICATOR_SERVICE,
  DEFAULT_SERVICE,
  LAST_BIOMETRIC_EMAIL_KEY,
  SESSION_TOKENS_SERVICE,
  TEMP_REGISTRATION_SERVICE,
} from '../keychain';

/**
 * The OS keychain is keyed by service name. Change one of these strings on a
 * shipped app and every existing entry becomes unreachable: users are silently
 * signed out, biometric enrolment is gone, and nothing fails at build time —
 * the app simply finds no credentials and behaves like a fresh install.
 *
 * They are now derived from `appConfig.identity.keychainNamespace` so a fork
 * sets them in one place. This test is what stops that indirection from also
 * making them easy to change by accident: the literals below are the values
 * this app has shipped, and they are not free to move.
 *
 * A genuine rebrand DOES change them, and that is a migration, not an edit.
 */
describe('keychain service names', () => {
  it('are exactly the strings this app has shipped', () => {
    expect(DEFAULT_SERVICE).toBe('dev.souschef.app.credentials');
    expect(CREDENTIALS_INDICATOR_SERVICE).toBe(
      'dev.souschef.app.credentials.indicator',
    );
    expect(TEMP_REGISTRATION_SERVICE).toBe(
      'dev.souschef.app.temp.registration',
    );
    expect(SESSION_TOKENS_SERVICE).toBe('dev.souschef.app.session.tokens');
  });

  it('keeps the biometric-email key off the namespace', () => {
    // Predates the reverse-DNS convention. Re-deriving it would strand the
    // stored value for every user who has biometrics enrolled.
    expect(LAST_BIOMETRIC_EMAIL_KEY).toBe('souschefrn-email');
  });
});
