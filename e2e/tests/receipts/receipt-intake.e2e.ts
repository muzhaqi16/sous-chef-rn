/**
 * Receipt intake (change `strengthen-pantry-tracking-and-consumption`, 8.1,
 * IN-01), judged on what the review offers and what the API recorded. The
 * receipt is a made-up shop's photo the spec adds to the simulator's library,
 * in a home of the spec's own. iOS only: the photo goes in through `simctl`.
 * Needs Metro started with `FEATURE_FLAGS=pantryTrackingFoundation=on`.
 */

import { execFileSync } from 'child_process';
import path from 'path';
import { element, by, waitFor, device } from 'detox';
import { expect as jestExpect } from '@jest/globals';
import { PantryScreen } from '../../screens/PantryScreen';
import { bootstrapAuthenticatedSession } from '../../helpers/auth';
import { generateItemName } from '../../helpers/data';
import { retry, waitForModalReady } from '../../helpers/waitFor';
import { t } from '../../helpers/i18n';
import { pickNewestPhoto } from '../../helpers/systemPhotoPicker';
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
import { kitTestIDs } from '../../../src/components/testIDs';

const WAIT = 15000;
const RECEIPT = path.join(
  __dirname,
  '../../fixtures/receipts/maple-corner-in01.jpg',
);

/** The one stack whose catalog name says what the receipt line bought. */
const stackOf = (stacks: StackOnServer[], food: RegExp): StackOnServer => {
  const named = stacks.filter(stack => food.test(stack.itemName));
  jestExpect(named).toHaveLength(1);
  const [stack] = named;
  if (!stack) throw new Error(`No stack named ${food.source}`);
  return stack;
};

describe('Receipt intake', () => {
  let home: TrackingHome;

  beforeAll(async () => {
    home = await openTrackingHome(generateItemName('Receipt'));
    // Added last, so the picker lists it first.
    execFileSync('xcrun', ['simctl', 'addmedia', device.id, RECEIPT]);
    await bootstrapAuthenticatedSession({ photoLibrary: true });
    await selectHome(home.homeId, WAIT);
    await new PantryScreen().navigateToTab();
  });

  afterAll(async () => {
    if (home) await closeTrackingHome(home);
  });

  it('IN-01 adds a receipt of eggs, a milk carton and unpriced spinach', async () => {
    await element(by.id(kitTestIDs.tabBarAddButton)).tap();
    const scanReceipt = element(by.id(kitTestIDs.tabBarAddAction('receipt')));
    const scanScreen = element(by.id(receiptsTestIDs.scanScreen));
    await waitFor(scanReceipt).toBeVisible().withTimeout(WAIT);
    await scanReceipt.tap();
    // A tap while the entries still slide in can miss: tapped again, as the
    // pantry page object does its add button.
    try {
      await waitFor(scanScreen).toBeVisible().withTimeout(5000);
    } catch {
      await scanReceipt.tap();
      await waitFor(scanScreen).toBeVisible().withTimeout(WAIT);
    }

    // A receipt an earlier run kept is replaced, else the first step starts
    // the scan; only which one is optional. The simulator has no document
    // scanner, so either way the screen offers a photo instead.
    const scanAnother = element(by.id(receiptsTestIDs.savedScanAnother));
    let kept = true;
    try {
      await waitFor(scanAnother).toBeVisible().withTimeout(3000);
    } catch {
      kept = false;
    }
    if (kept) {
      await scanAnother.tap();
      await waitForModalReady(kitTestIDs.alertButton(1), WAIT);
      await element(by.id(kitTestIDs.alertButton(1))).tap();
    } else {
      const startScan = element(by.id(receiptsTestIDs.startScan));
      await waitFor(startScan).toBeVisible().withTimeout(WAIT);
      await startScan.tap();
    }

    const choosePhoto = element(by.id(receiptsTestIDs.choosePhoto));
    await waitFor(choosePhoto).toBeVisible().withTimeout(WAIT);
    const { frame } = (await scanScreen.getAttributes()) as {
      frame: { y: number; width: number };
    };
    await choosePhoto.tap();
    await pickNewestPhoto(receiptsTestIDs.choosePhoto, frame);

    // The spinach whose price does not read is kept: three items, not two.
    const review = element(by.id(receiptsTestIDs.savedReview));
    await waitFor(review)
      .toHaveLabel(t('receipts.saved.review_other', { count: 3 }))
      .withTimeout(90000);
    await review.tap();
    const reviewScreen = element(by.id(receiptsTestIDs.reviewScreen));
    await waitFor(reviewScreen).toBeVisible().withTimeout(WAIT);

    // Every line resolved with nothing typed, so all three are to be added.
    const add = element(by.id(receiptsTestIDs.reviewAdd));
    await waitFor(add)
      .toHaveLabel(t('receipts.review.add_other', { count: 3 }))
      .withTimeout(WAIT);
    await add.tap();
    await waitFor(element(by.id(receiptsTestIDs.reviewScreen)))
      .not.toBeVisible()
      .withTimeout(WAIT);

    const stacks = await retry(async () => {
      const held = await pantryStacks(home.pantryId);
      if (held.length < 3) throw new Error(`${held.length} stacks so far`);
      return held;
    }, 15);
    // Each acquisition once.
    jestExpect(stacks).toHaveLength(3);

    const eggs = stackOf(stacks, /egg/i);
    jestExpect(eggs.amountLeft).toEqual({ value: 12, unit: 'pc' });
    jestExpect(eggs.totalPaid).toBe(3.49);

    // One carton reads as the 64 fl oz it holds, whatever unit the item tracks.
    const milk = stackOf(stacks, /milk/i);
    jestExpect(milk.amountLeft).toEqual({ value: 64, unit: 'fl oz' });
    jestExpect(milk.totalPaid).toBe(4.29);

    // 10 oz once, and its price stays unknown, never 0.
    const spinach = stackOf(stacks, /spinach/i);
    jestExpect({
      value: spinach.remainingNetWeight,
      unit: spinach.netWeightUnit,
    }).toEqual({ value: 10, unit: 'oz' });
    jestExpect(spinach.totalPaid).toBeNull();

    for (const { id } of stacks) {
      await waitFor(element(by.id(pantryTestIDs.item(id))))
        .toBeVisible()
        .withTimeout(WAIT);
    }
  });
});
