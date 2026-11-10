/**
 * The first-shop guide, end to end: the `+`, the hint in the add sheet, an
 * item added with its own +, checking one off, and putting one away.
 * Launched with the guide started and this account's tips fresh, so it runs
 * the same on every pass.
 */

import { element, by, waitFor } from 'detox';
import { bootstrapAuthenticatedSession } from '../../helpers/auth';
import { ShoppingListScreen } from '../../screens/ShoppingListScreen';
import { kitTestIDs } from '../../../src/components/testIDs';
import { shoppingListTestIDs } from '../../../src/features/shoppingList/testIDs';
import { catalogTestIDs } from '../../../src/features/catalog/testIDs';
import { GUIDE_TOURS } from '../../../src/domain/guides';
import { expectDisappearsAfter } from '../../helpers/assertions';

const SEARCH_INPUT = catalogTestIDs.addItemSheetSearchInput(
  shoppingListTestIDs.addSheetPrefix,
);
const TARGET = kitTestIDs.spotlightTarget;
const FIRST_RESULT_ADD = catalogTestIDs.quickAddResult(
  shoppingListTestIDs.addSheetPrefix,
  0,
);

/** The tip at this step is up, its target the one to tap. */
const stepShows = (progress: string) =>
  waitFor(element(by.text(progress)))
    .toBeVisible()
    .withTimeout(10000);

describe('The first-shop guide', () => {
  beforeAll(async () => {
    await bootstrapAuthenticatedSession({ guide: GUIDE_TOURS.shop });
  });

  it('walks from + to putting an item away, adding with the item’s own +', async () => {
    // A tip Today raises first is put away; the guide waits on the List.
    try {
      await waitFor(element(by.id(kitTestIDs.spotlightNotNowButton)))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id(kitTestIDs.spotlightNotNowButton)).tap();
    } catch {
      // No tip on Today.
    }
    await element(by.id(kitTestIDs.tab('ShoppingList'))).tap();

    await stepShows('1 of 4');
    await element(by.id(TARGET)).tap();

    // The hint is in the sheet from its first frame; any add continues it.
    await waitFor(element(by.id(shoppingListTestIDs.tourSheetHint)))
      .toBeVisible()
      .withTimeout(5000);
    // The search's results come below a short debounce; the + is the action
    // the hint names, so it is the one tapped.
    await element(by.id(SEARCH_INPUT)).replaceText('Tomatoes');
    await waitFor(element(by.id(FIRST_RESULT_ADD)))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id(FIRST_RESULT_ADD)).tap();
    await new ShoppingListScreen().dismissAddItemSheet();

    await stepShows('3 of 4');
    await element(by.id(TARGET)).tap();

    // Putting away is on Purchased, which the list switches to by itself.
    await stepShows('4 of 4');
    // The move, however made, ends the guide: its waiting step offers End
    // tour, and a one-step tip that may follow on the same spotlight has none.
    await expectDisappearsAfter(kitTestIDs.spotlightEndButton, async () => {
      await element(by.id(TARGET)).tap();
      await waitFor(element(by.id(shoppingListTestIDs.moveToPantryConfirm)))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id(shoppingListTestIDs.moveToPantryConfirm)).tap();
    });
  });
});
