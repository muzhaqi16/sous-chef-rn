/**
 * Receipt intake when delivery goes wrong (change
 * `strengthen-pantry-tracking-and-consumption`, 8.2, REL-01): a check-in whose
 * answer was lost, a cold start with no network, and the check-in delivered
 * twice. The app reaches the API through a proxy the spec controls
 * (`startApiProxy`, via the debug build's `detoxApiUrl`). iOS only: the photo
 * goes in through `simctl`. Needs Metro started with
 * `FEATURE_FLAGS=pantryTrackingFoundation=on`.
 */
import { execFileSync } from 'child_process';
import path from 'path';
import { element, by, waitFor, device } from 'detox';
import { expect as jestExpect } from '@jest/globals';
import { PantryScreen } from '../../screens/PantryScreen';
import { bootstrapAuthenticatedSession } from '../../helpers/auth';
import { generateItemName } from '../../helpers/data';
import { t } from '../../helpers/i18n';
import { reviewNewestReceiptPhoto } from '../../helpers/receiptScan';
import { startApiProxy, type ApiProxy } from '../../helpers/apiProxy';
import {
  closeTrackingHome,
  openTrackingHome,
  pantryStacks,
  selectHome,
  type StackOnServer,
  type TrackingHome,
} from '../../helpers/trackingHome';
import { receiptsTestIDs } from '../../../src/features/receipts/testIDs';
import { pantryTestIDs } from '../../../src/features/pantry/testIDs';

const WAIT = 15000;
const COLD_START = 45000;
const CHECK_IN = 'CreateReceiptCheckIn';
const RECEIPT = path.join(
  __dirname,
  '../../fixtures/receipts/maple-corner-in01.jpg',
);

/** What each stack holds and how many containers, by id. */
const heldBy = (stacks: StackOnServer[]) =>
  Object.fromEntries(
    stacks.map(stack => [
      stack.id,
      {
        amountLeft: stack.amountLeft,
        activeBatchCount: stack.activeBatchCount,
        totalPaid: stack.totalPaid,
      },
    ]),
  );

describe('Receipt intake when delivery goes wrong', () => {
  let proxy: ApiProxy;
  let home: TrackingHome;

  beforeAll(async () => {
    proxy = await startApiProxy();
    home = await openTrackingHome(generateItemName('Receipt'));
    // Added last, so the picker lists it first.
    execFileSync('xcrun', ['simctl', 'addmedia', device.id, RECEIPT]);
    await bootstrapAuthenticatedSession({
      photoLibrary: true,
      apiUrl: proxy.url,
    });
    await selectHome(home.homeId, WAIT);
    await new PantryScreen().navigateToTab();
  });

  afterAll(async () => {
    if (home) await closeTrackingHome(home);
    await proxy?.close();
  });

  it('REL-01 adds a receipt once whose answer was lost, through a restart and a repeated delivery', async () => {
    await reviewNewestReceiptPhoto(3, WAIT);
    const add = element(by.id(receiptsTestIDs.reviewAdd));
    await waitFor(add)
      .toHaveLabel(t('receipts.review.add_other', { count: 3 }))
      .withTimeout(WAIT);

    // The API records the check-in; its answer never reaches the app.
    const lost = proxy.loseNextAnswer(CHECK_IN);
    await add.tap();
    await lost;
    await proxy.goDown();

    // Recorded under the ids the app minted for its three stacks.
    const recorded = await pantryStacks(home.pantryId);
    jestExpect(recorded).toHaveLength(3);

    // A cold start with no network shows them from what the device holds.
    await bootstrapAuthenticatedSession({
      photoLibrary: true,
      apiUrl: proxy.url,
    });
    await new PantryScreen().navigateToTab();
    for (const { id } of recorded) {
      await waitFor(element(by.id(pantryTestIDs.item(id))))
        .toExist()
        .withTimeout(COLD_START);
    }

    // The network returns; the held check-in is delivered, and twice.
    const repeated = proxy.repeatNext(CHECK_IN);
    await proxy.comeBack();
    await repeated;

    // Each arrival once: the same three stacks, each one container as bought.
    const after = await pantryStacks(home.pantryId);
    jestExpect(after).toHaveLength(3);
    jestExpect(heldBy(after)).toEqual(heldBy(recorded));
    for (const stack of after) {
      jestExpect(stack.activeBatchCount).toBe(1);
    }
  });
});
