/**
 * Device validation for the item edit-suggestion flow (PR 171).
 *
 * Reaches SearchResults by deep link (`scan/result`) rather than the camera —
 * the simulator has none, and the barcode scanner is the only other way in.
 * The URL is delivered at cold start via `launchApp({ url })` alongside the
 * injected session, because `openURL` on an already-running app does not
 * reliably route here.
 *
 * The UPC below is a seeded PUBLIC catalog item the test user did not create,
 * so the API resolves `canEdit: false` and the card must offer "Suggest Edit"
 * rather than "Edit". That routing is the thing under test: the client used to
 * guess it from `visibility` + admin role and now reads the server's
 * viewer-scoped `canEdit`.
 *
 * Run: npx detox test -c ios.sim.debug e2e/tests/suggest-edit.e2e.ts
 */
import { device, element, by, waitFor } from 'detox';
import { getAuthTokens } from '../helpers/tokenProvider';
import { dismissBiometricPromptIfPresent } from '../helpers/auth';
import { t } from '../helpers/i18n';

// Seeded, PUBLIC, not created by the test user -> canEdit: false.
const PUBLIC_ITEM_UPC = '085239110201'; // Ground Beef

const settle = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const shoot = async (name: string) => {
  try {
    await device.takeScreenshot(name);
  } catch {
    // Best-effort; never fail an assertion on a screenshot.
  }
};

describe('Item edit suggestions', () => {
  beforeAll(async () => {
    const tokens = await getAuthTokens();
    // Session + deep link together: a cold start with `url` is the only form
    // Detox routes reliably, and the session must be present at that start or
    // the link lands on the login screen.
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES', camera: 'YES' },
      url: `souschef://scan/result?barcode=${PUBLIC_ITEM_UPC}`,
      launchArgs: {
        detoxUserToken: tokens.accessToken,
        detoxRefreshToken: tokens.refreshToken,
        detoxUser: JSON.stringify(tokens.user),
      },
    });
    await settle(4000);
    await dismissBiometricPromptIfPresent();
    await settle(1000);
    await shoot('01-after-deeplink');
  });

  it('lands on the scanned item rather than the pantry', async () => {
    await waitFor(element(by.text('Ground Beef')))
      .toBeVisible()
      .withTimeout(20000);
  });

  it('offers Suggest Edit for an item the user may not edit directly', async () => {
    // canEdit: false -> the suggestion wording, never "Edit".
    await waitFor(element(by.text(t('suggestItemEdit.suggestAction'))))
      .toBeVisible()
      .withTimeout(10000);
    await shoot('02-suggest-edit-visible');
  });

  it('opens the form worded as a review, not an immediate change', async () => {
    await element(by.text(t('suggestItemEdit.suggestAction'))).tap();
    await settle(2500);
    await shoot('03-suggest-edit-sheet');

    // The subtitle is what separates the two routes: `directEdit` promises the
    // change goes live immediately, `edit` promises review. Asserted through
    // the resolved copy rather than a literal, so rewording en.json can't leave
    // this passing against a string the app no longer shows.
    await waitFor(element(by.id('add-item-form-subtitle')))
      .toHaveText(t('addItemForm.modes.edit.subtitle'))
      .withTimeout(10000);
  });

  it('leads the form with the note the reviewer needs', async () => {
    // The note sits first on Basics and is required on this path. It used to be
    // optional and buried on tab 4 under "More options", where a required field
    // would block submit with no visible cause.
    await waitFor(
      element(by.text(t('addItemForm.fields.editNote.placeholder'))),
    )
      .toBeVisible()
      .withTimeout(10000);
  });
});
