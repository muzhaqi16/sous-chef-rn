import { element, by, waitFor } from 'detox';
import { t } from './i18n';
import { waitForModalReady } from './waitFor';
import { pickNewestPhoto } from './systemPhotoPicker';
import { receiptsTestIDs } from '../../src/features/receipts/testIDs';
import { kitTestIDs } from '../../src/components/testIDs';

// What the API takes to read a receipt photo.
const READ_MS = 90000;

/**
 * Scans the newest photo in the simulator's library as a receipt, from the tab
 * bar's add menu, and opens its review once the API has read `items` items.
 */
export async function reviewNewestReceiptPhoto(
  items: number,
  wait = 15000,
): Promise<void> {
  await element(by.id(kitTestIDs.tabBarAddButton)).tap();
  const scanReceipt = element(by.id(kitTestIDs.tabBarAddAction('receipt')));
  const scanScreen = element(by.id(receiptsTestIDs.scanScreen));
  await waitFor(scanReceipt).toBeVisible().withTimeout(wait);
  await scanReceipt.tap();
  // A tap while the entries still slide in can miss: tapped again, as the
  // pantry page object does its add button.
  try {
    await waitFor(scanScreen).toBeVisible().withTimeout(5000);
  } catch {
    await scanReceipt.tap();
    await waitFor(scanScreen).toBeVisible().withTimeout(wait);
  }
  // A receipt an earlier run kept is replaced, else the first step starts the
  // scan; only which one is optional. The simulator has no document scanner,
  // so either way the screen offers a photo instead.
  const scanAnother = element(by.id(receiptsTestIDs.savedScanAnother));
  let kept = true;
  try {
    await waitFor(scanAnother).toBeVisible().withTimeout(3000);
  } catch {
    kept = false;
  }
  if (kept) {
    await scanAnother.tap();
    await waitForModalReady(kitTestIDs.alertButton(1), wait);
    await element(by.id(kitTestIDs.alertButton(1))).tap();
  } else {
    const startScan = element(by.id(receiptsTestIDs.startScan));
    await waitFor(startScan).toBeVisible().withTimeout(wait);
    await startScan.tap();
  }
  const choosePhoto = element(by.id(receiptsTestIDs.choosePhoto));
  await waitFor(choosePhoto).toBeVisible().withTimeout(wait);
  const { frame } = (await scanScreen.getAttributes()) as {
    frame: { y: number; width: number };
  };
  await choosePhoto.tap();
  await pickNewestPhoto(receiptsTestIDs.choosePhoto, frame);
  const review = element(by.id(receiptsTestIDs.savedReview));
  await waitFor(review)
    .toHaveLabel(t('receipts.saved.review_other', { count: items }))
    .withTimeout(READ_MS);
  await review.tap();
  await waitFor(element(by.id(receiptsTestIDs.reviewScreen)))
    .toBeVisible()
    .withTimeout(wait);
}
