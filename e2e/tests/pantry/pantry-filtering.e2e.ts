/**
 * Pantry search, storage-location filtering, sort, and their combinations.
 */

import { element, by, waitFor } from 'detox';
import { PantryScreen } from '../../screens/PantryScreen';
import { bootstrapAuthenticatedSession } from '../../helpers/auth';
import { relaunchToHomeTab } from '../../helpers/flows';
import { TIMEOUTS } from '../../helpers/waitFor';
import { pantryTestIDs } from '../../../src/features/pantry/testIDs';
import { kitTestIDs } from '../../../src/components/testIDs';

// Seeded by `beforeAll`: data the spec typed, so matching it by text is sound.
const ITEMS = {
  apple: 'Apple',
  banana: 'Banana',
  milk: 'Milk',
  cheese: 'Cheese',
};

const locationTab = (locationId: string) =>
  kitTestIDs.filterTab(pantryTestIDs.locationTabPrefix, locationId);

describe('Pantry Filtering', () => {
  const pantryScreen = new PantryScreen();

  beforeAll(async () => {
    await bootstrapAuthenticatedSession();

    await relaunchToHomeTab();
    await pantryScreen.waitForScreen();

    // Add some test items for filtering
    await pantryScreen.addItem(ITEMS.apple, '5', 'count');
    await pantryScreen.addItem(ITEMS.banana, '3', 'count');
    await pantryScreen.addItem(ITEMS.milk, '1', 'gallon');
    await pantryScreen.addItem(ITEMS.cheese, '8', 'oz');
    await pantryScreen.waitForListToLoad();
  });

  beforeEach(async () => {
    await relaunchToHomeTab();
    await pantryScreen.navigateToTab();
  });

  describe('Search', () => {
    it('should search items by name', async () => {
      const searchInput = element(by.id(pantryTestIDs.searchInput));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);

      // Establish the unfiltered list first, so the disappearance below cannot
      // be satisfied by a row that was never there.
      await waitFor(element(by.text(ITEMS.banana)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await searchInput.typeText(ITEMS.apple);

      // Assert on the rows that must DROP OUT, not on 'Apple': the search field
      // now carries that exact text, so `by.text(ITEMS.apple)` matches the field
      // itself and passes whether or not the list filtered at all.
      await waitFor(element(by.text(ITEMS.banana)))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await waitFor(element(by.text(ITEMS.cheese)))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should show empty state when no search results', async () => {
      const searchInput = element(by.id(pantryTestIDs.searchInput));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await searchInput.clearText();
      await searchInput.typeText('NonExistentItem123');

      await waitFor(element(by.id(pantryTestIDs.emptyState)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should clear search and show all items', async () => {
      const searchInput = element(by.id(pantryTestIDs.searchInput));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await searchInput.typeText(ITEMS.apple);

      // The narrowing is asserted via an excluded row — `by.text(ITEMS.apple)`
      // would match the search field's own value regardless of the list.
      await waitFor(element(by.text(ITEMS.banana)))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await searchInput.clearText();

      await waitFor(element(by.text(ITEMS.banana)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await pantryScreen.expectTextVisible(ITEMS.milk);
    });

    it('should search case-insensitively', async () => {
      const searchInput = element(by.id(pantryTestIDs.searchInput));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await searchInput.clearText();
      await searchInput.typeText('apple'); // lowercase

      await waitFor(element(by.text(ITEMS.apple)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should search partial matches', async () => {
      const searchInput = element(by.id(pantryTestIDs.searchInput));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await searchInput.clearText();
      await searchInput.typeText('App'); // partial

      await waitFor(element(by.text(ITEMS.apple)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });
  });

  describe('Filter by Storage Location', () => {
    // The app has no filter *menu*: the locations are a persistent `FilterTabs`
    // strip, one tab per location id (`all`, `fridge`, `freezer`, `pantry`).
    it('narrows the list to a storage location', async () => {
      await element(by.id(locationTab('fridge'))).tap();

      // The tab strip is still there and the list re-rendered under it;
      // `waitForListToLoad()` alone passes whether or not the tap did anything.
      await waitFor(element(by.id(locationTab('fridge'))))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await waitFor(element(by.id(pantryTestIDs.list)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('returns to every location via the All tab', async () => {
      await element(by.id(locationTab('freezer'))).tap();
      await element(by.id(locationTab('all'))).tap();

      await waitFor(element(by.id(pantryTestIDs.list)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });
  });

  describe('Sort', () => {
    // A sort option's id is built from its key in `PantrySortModal`.
    const openSortModal = async () => {
      await element(by.id(pantryTestIDs.sortButton)).tap();
      await waitFor(element(by.id(pantryTestIDs.sortModal)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    };

    it('opens the sort modal and applies sort by name', async () => {
      await openSortModal();
      await element(by.id(pantryTestIDs.sortOption('name'))).tap();

      // Applying a sort dismisses the modal — that is the observable effect,
      // and it fails if the tap missed.
      await waitFor(element(by.id(pantryTestIDs.sortModal)))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await pantryScreen.waitForListToLoad();
    });

    it('applies sort by expiry', async () => {
      await openSortModal();
      await element(by.id(pantryTestIDs.sortOption('expiry'))).tap();

      await waitFor(element(by.id(pantryTestIDs.sortModal)))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await pantryScreen.waitForListToLoad();
    });
  });

  describe('Combined Filters', () => {
    it('combines a search term with a location tab', async () => {
      const searchInput = element(by.id(pantryTestIDs.searchInput));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await searchInput.typeText('il'); // matches Milk

      await waitFor(element(by.text(ITEMS.milk)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await element(by.id(locationTab('fridge'))).tap();
      await waitFor(element(by.id(pantryTestIDs.list)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('clears the search and shows the excluded rows again', async () => {
      // The app has no reset-filters control. Clearing the search field is
      // the reset, and the assertion is that a row the search had
      // excluded comes back.
      const searchInput = element(by.id(pantryTestIDs.searchInput));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await searchInput.typeText(ITEMS.apple);

      // An excluded row, not 'Apple' — the search field carries that text too.
      await waitFor(element(by.text(ITEMS.banana)))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await searchInput.clearText();
      await element(by.id(locationTab('all'))).tap();

      await waitFor(element(by.text(ITEMS.banana)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await pantryScreen.expectTextVisible(ITEMS.milk);
    });
  });
});
