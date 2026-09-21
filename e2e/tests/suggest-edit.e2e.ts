/**
 * Device validation for item edit suggestions (PR 171). Reaches SearchResults
 * by deep link (`scan/result`) — the simulator has no camera. Edit vs Suggest
 * Edit comes from the server's viewer-scoped `canEdit`.
 * Run: npx detox test -c ios.sim.debug e2e/tests/suggest-edit.e2e.ts
 */
import { device, element, by, waitFor } from 'detox';
import { getAuthTokens } from '../helpers/tokenProvider';
import { dismissBiometricPromptIfPresent } from '../helpers/auth';
import { t } from '../helpers/i18n';
import { barcodeTestIDs } from '../../src/features/barcode/testIDs';
import { catalogTestIDs } from '../../src/features/catalog/testIDs';

// Seeded, PUBLIC, not created by the test user -> canEdit: false.
const PUBLIC_ITEM_UPC = '085239110201';
const PUBLIC_ITEM_NAME = 'Ground Beef';

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
    await waitFor(element(by.text(PUBLIC_ITEM_NAME)))
      .toBeVisible()
      .withTimeout(20000);
  });

  it('offers Suggest Edit for an item the user may not edit directly', async () => {
    // canEdit: false -> the suggestion wording, never "Edit".
    await waitFor(element(by.id(barcodeTestIDs.productEditActionLabel)))
      .toHaveText(t('labels.suggestEdit'))
      .withTimeout(10000);
    await shoot('02-suggest-edit-visible');
  });

  it('opens the form worded as a review, not an immediate change', async () => {
    await element(by.id(barcodeTestIDs.productEditAction)).tap();
    await settle(2500);
    await shoot('03-suggest-edit-sheet');

    // The subtitle is what separates the two routes: `directEdit` promises the
    // change goes live immediately, `edit` promises review. Asserted through
    // the resolved copy rather than a literal, so rewording en.json can't leave
    // this passing against a string the app does not render.
    await waitFor(element(by.id(catalogTestIDs.addItemFormSubtitle)))
      .toHaveText(t('addItemForm.modes.edit.subtitle'))
      .withTimeout(10000);
  });

  it('leads the form with the note the reviewer needs', async () => {
    // The note sits first on Basics and is required on this path.
    await waitFor(element(by.id(catalogTestIDs.addItemFormEditNoteInput)))
      .toBeVisible()
      .withTimeout(10000);
  });
});
