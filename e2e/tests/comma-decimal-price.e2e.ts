/**
 * On-device validation for locale-aware decimal parsing. `keyboardType` renders
 * the DEVICE locale's separator, so a Spanish or Italian phone offers `,` — and
 * `parseFloat('4,99')` is 4: a silently wrong number written to the server, not
 * a rejection the user can see. Drives keystroke → form → mutation for real.
 */
import { element, by, waitFor } from 'detox';
import { ShoppingListScreen } from '../screens';
import { bootstrapAuthenticatedSession } from '../helpers';
import { TIMEOUTS } from '../helpers/waitFor';

// `fetch` fails inside Detox's jest environment, so this spec does UI only.
// `scripts/verify-comma-decimal.sh` supplies these and reads the stored
// `priceEstimate.estimated` back from the server before and after — the bug was
// in what got persisted, not in what the form held.
const ITEM_ID = process.env.E2E_ITEM_ID;
const ITEM_NAME = process.env.E2E_ITEM_NAME;
/** Rotated by the script so a run can never re-type the value already stored. */
const PRICE = process.env.E2E_PRICE ?? '4,99';

// The EDIT screen, not the add sheet: the sheet's name field is a modal-variant
// autocomplete, so `replaceText` never registers a selection and submit creates
// nothing. The edit screen has plain inputs and owns `edit-item-price-input`.
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
    // row's checkbox swallows the gesture anyway.
    // by.id, not by.text: once the list is filtered by this name the SEARCH
    // FIELD carries the same text, so `by.text(name)` matches it instead of the
    // row, and tapping that opens iOS's selection callout.
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
    // (10, 10) — that corner is the header's back button, which closes the
    // editor and makes the submit below miss entirely.
    await element(by.id('edit-item-price-input')).tapReturnKey();
    await new Promise(resolve => setTimeout(resolve, 500));

    await waitFor(element(by.id('edit-item-submit-button')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);
    await element(by.id('edit-item-submit-button')).tap();

    // Assert on the price field, not on `edit-item-modal`: that id lands on
    // FormModal's full-screen container, and Detox counts an obscured element as
    // not visible, so `.not.toBeVisible()` is satisfied with the editor open.
    // KNOWN GAP — the run fails at the submit: the field shows `4,99` (so the
    // comma is accepted) but the editor does not close. Diagnose the submit
    // before trusting a pass.
    await waitFor(element(by.id('edit-item-price-input')))
      .not.toBeVisible()
      .withTimeout(TIMEOUTS.NETWORK);
    await new Promise(resolve => setTimeout(resolve, 2000));
  });
});
