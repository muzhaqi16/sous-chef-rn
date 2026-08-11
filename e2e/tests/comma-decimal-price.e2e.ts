/**
 * On-device validation for locale-aware decimal parsing.
 *
 * `keyboardType` renders the separator key of the DEVICE locale, so a Spanish
 * or Italian phone offers `,`. Every numeric field used to read its value with
 * `parseFloat`, and `parseFloat('4,99')` is `4` — not a rejection the user can
 * see and correct, but a silently wrong number written to the server.
 *
 * `parseDecimalInput` has unit tests, but they pin the parser in isolation and
 * cannot catch a call site the sweep missed. This drives the real path:
 * keystroke → form state → mutation input → server.
 *
 * **Why the EDIT screen, not the add sheet.** The sheet's name field is a
 * modal-variant autocomplete, so `replaceText` never registers a selection and
 * submit creates nothing. That path also produces a FALSE PASS: after typing
 * the name into the search box to find the row, `by.text(name)` matches the
 * search field itself. The edit screen has plain inputs and owns
 * `edit-item-price-input`, the field the bug was reported against.
 *
 * **Why the assertion lives outside this file.** `fetch` fails inside Detox's
 * jest environment even though the same query succeeds from plain Node, so the
 * spec does UI only. The caller reads `priceEstimate.estimated` back from the
 * server before and after — see `scripts/verify-comma-decimal.sh`. Asserting in
 * the UI would only prove the form kept the string; the bug was in what got
 * persisted.
 *
 * `E2E_ITEM_ID` is the shopping-list item to edit, supplied by that script.
 */
import { element, by, waitFor } from 'detox';
import { ShoppingListScreen } from '../screens';
import { bootstrapAuthenticatedSession } from '../helpers';
import { TIMEOUTS } from '../helpers/waitFor';

const ITEM_ID = process.env.E2E_ITEM_ID;
const ITEM_NAME = process.env.E2E_ITEM_NAME;

describe('comma-typed decimal price', () => {
  const shoppingList = new ShoppingListScreen();

  beforeAll(async () => {
    if (!ITEM_ID) {
      throw new Error(
        'E2E_ITEM_ID is not set — run via scripts/verify-comma-decimal.sh, which resolves the item and asserts the stored price.',
      );
    }
    await bootstrapAuthenticatedSession();
  });

  it('types 4,99 into the estimated price and saves', async () => {
    await shoppingList.navigateToTab();

    // Filter to the target first. The API orders items differently from the
    // list, so the row is usually below the fold — and Detox `toBeVisible`
    // only matches what is actually on screen.
    if (ITEM_NAME) {
      const search = element(by.id('shopping-list-search-input'));
      await waitFor(search).toBeVisible().withTimeout(TIMEOUTS.NETWORK);
      await search.replaceText(ITEM_NAME);
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    // Reach the editor through the row's detail screen rather than its swipe
    // action: Detox swipes do not reliably open an RNGH `Swipeable`, and the
    // checkbox swallows the gesture anyway (see the note atop SortableItem).
    // Tapping the row opens ItemDetail, which offers the same editor.
    // atIndex(1), not 0: the search field now contains the same text, and
    // index 0 matches THAT. Tapping it opens iOS's selection callout and the
    // row is never reached — the same false match that made an earlier version
    // of this spec report success while doing nothing.
    const row = element(by.text(ITEM_NAME as string)).atIndex(1);
    await waitFor(row).toBeVisible().withTimeout(TIMEOUTS.NETWORK);
    await row.tap();

    const editAction = element(by.id('shopping-item-edit-button'));
    await waitFor(editAction).toBeVisible().withTimeout(TIMEOUTS.NETWORK);
    await editAction.tap();

    await waitFor(element(by.id('edit-item-modal')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.NETWORK);

    // The comma, exactly as a Spanish/Italian keypad emits it.
    await element(by.id('edit-item-price-input')).replaceText('4,99');

    // Dismiss the keyboard so the header submit button is hittable.
    await element(by.id('edit-item-modal')).tap({ x: 10, y: 10 });
    await new Promise(resolve => setTimeout(resolve, 500));
    await element(by.id('edit-item-submit-button')).tap();

    // Leaving the editor means the save round-tripped rather than erroring.
    await waitFor(element(by.id('edit-item-modal')))
      .not.toBeVisible()
      .withTimeout(TIMEOUTS.NETWORK);
    await new Promise(resolve => setTimeout(resolve, 2000));
  });
});
