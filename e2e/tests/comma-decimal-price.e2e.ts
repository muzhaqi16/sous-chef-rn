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
/** Rotated by the script so a run can never re-type the value already stored. */
const PRICE = process.env.E2E_PRICE ?? '4,99';

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
    // by.id, not by.text — Detox's own guidance, and the reason matters here:
    // once the list is filtered by this name the SEARCH FIELD carries the same
    // text, so `by.text(name)` matched it instead of the row. Tapping that
    // opened iOS's selection callout and the row was never touched, which is
    // what made an earlier version of this spec report success while doing
    // nothing.
    const row = element(by.id(`shopping-list-item-${ITEM_ID}`));
    await waitFor(row).toBeVisible().withTimeout(TIMEOUTS.NETWORK);
    await row.tap();

    const editAction = element(by.id('shopping-item-edit-button'));
    await waitFor(editAction).toBeVisible().withTimeout(TIMEOUTS.NETWORK);
    await editAction.tap();

    // Wait on the field itself rather than the modal wrapper, and allow more
    // than TIMEOUTS.NETWORK (5s): the editor is a lazily-loaded screen, so the
    // first navigation to it has to fetch and evaluate the chunk.
    await waitFor(element(by.id('edit-item-price-input')))
      .toBeVisible()
      .withTimeout(20000);

    // The comma, exactly as a Spanish/Italian keypad emits it.
    await element(by.id('edit-item-price-input')).replaceText(PRICE);

    // Dismiss the keyboard via the return key, NOT by tapping the modal at
    // (10, 10) — that corner is the header's back button, so it closed the
    // editor and the submit below then missed entirely.
    await element(by.id('edit-item-price-input')).tapReturnKey();
    await new Promise(resolve => setTimeout(resolve, 500));

    await waitFor(element(by.id('edit-item-submit-button')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);
    await element(by.id('edit-item-submit-button')).tap();

    // KNOWN GAP — this spec is not yet trustworthy end to end.
    //
    // `edit-item-modal` is passed to the modal wrapper as a prop but does not
    // reach a matchable element, so asserting `.not.toBeVisible()` on it passed
    // VACUOUSLY while the editor was still open and nothing had been saved.
    // Waiting for the price field to disappear is the honest check.
    //
    // With this in place the run fails at the submit: the field shows `4,99`
    // (confirmed on screen, so the comma is accepted) but the editor never
    // closes, i.e. `edit-item-submit-button` is not reaching the header's ✓.
    // Verify that testID actually lands on the button before trusting a pass.
    await waitFor(element(by.id('edit-item-price-input')))
      .not.toBeVisible()
      .withTimeout(TIMEOUTS.NETWORK);
    await new Promise(resolve => setTimeout(resolve, 2000));
  });
});
