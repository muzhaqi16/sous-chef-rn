/**
 * Pantry CRUD. "Add Manually" opens `AddDetailsSheet`, a **PagerView** of four
 * pages (Main / Details / Storage / Stock): a field on another page reports "No
 * elements found" because it is UNMOUNTED, not off-screen. Quantity and unit
 * live on Details, NOT Stock. `expectItemInPantry` scrolls to the row.
 */

import { element, by, waitFor, expect } from 'detox';
import { PantryScreen } from '../../screens/PantryScreen';
import { bootstrapAuthenticatedSession } from '../../helpers/auth';
import { relaunchToHomeTab } from '../../helpers/flows';
import { generateItemName } from '../../helpers/data';
import { TIMEOUTS } from '../../helpers/waitFor';

const NAME_INPUT = 'add-pantry-item-name-input';
const SUBMIT_BUTTON = 'add-pantry-item-submit-button';
const CANCEL_BUTTON = 'add-pantry-item-cancel-button';

describe('Pantry CRUD', () => {
  const pantryScreen = new PantryScreen();
  let itemsToCleanup: string[] = [];

  beforeAll(async () => {
    // Newest-first, seeded at launch rather than driven through the sort modal.
    // `recent` + `asc` IS newest-first — its comparator is inverted relative to
    // the other options, which `usePantrySorting.test.ts` asserts. The app's own
    // default `recent` + `desc` is OLDEST first, which would strand a fresh row
    // at the far end of a 48-item list.
    await bootstrapAuthenticatedSession({
      pantrySort: { option: 'recent', direction: 'asc' },
    });
  });

  beforeEach(async () => {
    await relaunchToHomeTab();
    await pantryScreen.waitForScreen();
    itemsToCleanup = [];
  });

  afterEach(async () => {
    for (const itemName of itemsToCleanup) {
      try {
        await pantryScreen.deleteItemByName(itemName);
      } catch {
        // Best-effort teardown. A cleanup miss must not fail the test that just
        // passed — the assertions live in the `it` blocks.
      }
    }
  });

  describe('Add Item', () => {
    it('adds an item with a name only', async () => {
      const itemName = generateItemName('Minimal');
      itemsToCleanup.push(itemName);

      await pantryScreen.addItem(itemName);

      await pantryScreen.expectItemInPantry(itemName);
    });

    it('adds an item with a quantity and unit', async () => {
      const itemName = generateItemName('WithQty');
      itemsToCleanup.push(itemName);

      // Quantity and unit are on page 1; `addItem` navigates there.
      await pantryScreen.addItem(itemName, '2', 'lb');

      await pantryScreen.expectItemInPantry(itemName);
      await pantryScreen.expectQuantityRendered('2 lb');
    });

    it('refuses to submit without a name', async () => {
      await pantryScreen.openAddDetailsForm();

      await element(by.id(SUBMIT_BUTTON)).tap();

      // The sheet staying open IS the validation result. Asserting on an error
      // dialog would be brittle: the copy is translated, and it is a native
      // alert on one platform and in-app on the other.
      await waitFor(element(by.id(NAME_INPUT)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // No teardown needed — `relaunchToHomeTab` reloads before each test, so a
      // sheet left open here cannot reach the next one.
    });

    it('closes the details sheet on cancel', async () => {
      await pantryScreen.openAddDetailsForm();
      await element(by.id(CANCEL_BUTTON)).tap();

      // Dismissal is the sheet's own Cancel button — `header-back-button`
      // belongs to `Header`, which these sheets never render. Deliberately NOT
      // asserting the pantry list is back: cancel drops to the picker sheet that
      // opened this one, and how far the stack unwinds depends on how the two
      // dismiss animations overlap.
      await waitFor(element(by.id(NAME_INPUT)))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });
  });

  describe('Delete Item', () => {
    it('deletes an item via swipe', async () => {
      const itemName = generateItemName('ToDelete');
      await pantryScreen.addItem(itemName);
      await pantryScreen.expectItemInPantry(itemName);

      await pantryScreen.deleteItemByName(itemName);

      await waitFor(element(by.text(itemName)))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('keeps the item when the swipe is not followed through', async () => {
      const itemName = generateItemName('KeepMe');
      itemsToCleanup.push(itemName);
      await pantryScreen.addItem(itemName);
      await pantryScreen.expectItemInPantry(itemName);

      // A short swipe reveals the actions without committing to one.
      await element(by.text(itemName)).swipe('left', 'fast', 0.3);

      await expect(element(by.text(itemName))).toExist();
    });
  });

  describe('Quantity input edge cases', () => {
    // `parseFloat('4,99')` is 4, and a fraction in a number field can be
    // dropped. The parser has unit tests; this pins the wiring through the real
    // form. Each case asserts the RENDERED quantity, not just that a row
    // appeared: "1 1/4" arriving as 1 still produces a row with the right name.
    it('accepts a fractional quantity', async () => {
      const itemName = generateItemName('Fraction');
      itemsToCleanup.push(itemName);

      await pantryScreen.addItem(itemName, '1 1/4', 'cup');

      await pantryScreen.expectItemInPantry(itemName);
      // `parseFloat('1 1/4')` is 1, so a row existing proves nothing about the
      // parse — this asserts the value that reached the card.
      // `formatQuantityDisplay` renders a non-integer under 10 with 2 decimals.
      await pantryScreen.expectQuantityRendered('1.25 cup');
    });

    it('accepts a decimal quantity', async () => {
      const itemName = generateItemName('Decimal');
      itemsToCleanup.push(itemName);

      await pantryScreen.addItem(itemName, '0.25', 'kg');

      await pantryScreen.expectItemInPantry(itemName);
      await pantryScreen.expectQuantityRendered('0.25 kg');
    });

    it('accepts a long item name', async () => {
      const longName = generateItemName('A'.repeat(40));
      itemsToCleanup.push(longName);

      await pantryScreen.addItem(longName);

      await pantryScreen.expectItemInPantry(longName);
    });
  });
});
