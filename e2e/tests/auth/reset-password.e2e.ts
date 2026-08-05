/**
 * Device validation for the "choose a new password" screen.
 *
 * This is the screen behind a password-reset link, not the request-a-link
 * screen that `password-reset.e2e.ts` covers. It is only reachable by deep
 * link, and only at cold start — `openURL` against a running app does not
 * route here reliably.
 *
 * Two shipped bugs are pinned here:
 *  - the submit button stayed disabled no matter what was typed, because the
 *    inputs wrote through `setValue` without asking for validation, so
 *    `formState.isValid` never recomputed;
 *  - the screen had no scroll container, so the keyboard covered the confirm
 *    field and the button.
 *
 * The token is deliberately bogus: the API rejects it and the screen shows an
 * error toast. That toast is the signal the mutation actually fired, which is
 * only possible if the button was enabled. Asserting the button's disabled
 * flag directly is not something Detox exposes on Android.
 *
 * Run: npx detox test -c android.att.debug e2e/tests/auth/reset-password.e2e.ts
 */
import { device, element, by, expect as detoxExpect } from 'detox';
import { ResetPasswordScreen } from '../../screens';

// Long enough to clear the screen's client-side format check (>= 10 chars),
// so we land on the form rather than the "Invalid Reset Link" view.
const BOGUS_TOKEN = 'e2e-token-0123456789';
const VALID_PASSWORD = 'Test123!';

const settle = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Reset password (choose new password)', () => {
  const resetScreen = new ResetPasswordScreen();

  const openResetScreen = async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
      url: `souschef://reset-password?token=${BOGUS_TOKEN}`,
    });
    await settle(3000);
    await resetScreen.waitForScreen(20000);
  };

  beforeEach(openResetScreen);

  it('opens the form from a reset link', async () => {
    await resetScreen.expectSubmitVisible();
  });

  it('keeps the confirm field and button clear of the open keyboard', async () => {
    // Focusing the first field raises the keyboard; without a scroll
    // container it covered both of these.
    await resetScreen.enterNewPassword(VALID_PASSWORD);
    await resetScreen.expectFormReachableWithKeyboardOpen();
  });

  it('rejects a spent link rather than leaving the user on the form', async () => {
    await resetScreen.resetPasswordTo(VALID_PASSWORD);

    // The API answers a bad token with status INVALID_OR_EXPIRED, which the
    // screen turns into the invalid-link view. Asserting on that rather than
    // on the toast: the toast is up for 1.4s and its testID tracks whichever
    // type is showing, whereas this view persists.
    await resetScreen.expectRejectedLinkVisible();
  });

  it('does not submit while only the first field is filled', async () => {
    await resetScreen.enterNewPassword(VALID_PASSWORD);
    await resetScreen.submit();

    await settle(3000);

    // Nothing was sent, so no toast — and the form is still on screen.
    await detoxExpect(element(by.id('toast-error'))).not.toExist();
    await resetScreen.expectScreenVisible();
  });

  it('does not submit when the confirmation does not match', async () => {
    await resetScreen.enterNewPassword(VALID_PASSWORD);
    await resetScreen.enterConfirmPassword('Test123?');
    await resetScreen.submit();

    await settle(3000);

    await detoxExpect(element(by.id('toast-error'))).not.toExist();
    await resetScreen.expectScreenVisible();
  });
});
