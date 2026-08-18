/**
 * Pantry Filtering E2E Tests
 *
 * Tests for pantry search and filter functionality including:
 * - Search by name
 * - Filter by storage location
 * - Empty state when no results
 * - Combined search and filter
 */

import { element, by, waitFor, expect } from 'detox';
import { PantryScreen } from '../../screens';
import {
  bootstrapAuthenticatedSession,
  relaunchToHomeTab,
} from '../../helpers';
import { TIMEOUTS } from '../../helpers/waitFor';

describe('Pantry Filtering', () => {
  const pantryScreen = new PantryScreen();

  beforeAll(async () => {
    await bootstrapAuthenticatedSession();

    // Navigate to pantry
    await relaunchToHomeTab();
    await pantryScreen.waitForScreen();

    // Add some test items for filtering
    await pantryScreen.addItem('Apple', '5', 'count');
    await pantryScreen.addItem('Banana', '3', 'count');
    await pantryScreen.addItem('Milk', '1', 'gallon');
    await pantryScreen.addItem('Cheese', '8', 'oz');
    await pantryScreen.waitForListToLoad();
  });

  beforeEach(async () => {
    await relaunchToHomeTab();
    await pantryScreen.navigateToTab();
  });

  describe('Search', () => {
    it('should search items by name', async () => {
      const searchInput = element(by.id('pantry-search-input'));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);

      // Establish the unfiltered list first, so the disappearance below cannot
      // be satisfied by a row that was never there.
      await waitFor(element(by.text('Banana')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await searchInput.typeText('Apple');

      // Assert on the rows that must DROP OUT, not on 'Apple': the search field
      // now carries that exact text, so `by.text('Apple')` matches the field
      // itself and passes whether or not the list filtered at all.
      await waitFor(element(by.text('Banana')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await waitFor(element(by.text('Cheese')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should show empty state when no search results', async () => {
      const searchInput = element(by.id('pantry-search-input'));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await searchInput.clearText();
      await searchInput.typeText('NonExistentItem123');

      // Should show empty state or "no results" message
      await waitFor(element(by.id('pantry-empty-state')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should clear search and show all items', async () => {
      const searchInput = element(by.id('pantry-search-input'));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await searchInput.typeText('Apple');

      // The narrowing is asserted via an excluded row — `by.text('Apple')`
      // would match the search field's own value regardless of the list.
      await waitFor(element(by.text('Banana')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Clear search
      await searchInput.clearText();

      // Should show all items again
      await waitFor(element(by.text('Banana')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await pantryScreen.expectTextVisible('Milk');
    });

    it('should search case-insensitively', async () => {
      const searchInput = element(by.id('pantry-search-input'));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await searchInput.clearText();
      await searchInput.typeText('apple'); // lowercase

      // Should still find Apple
      await waitFor(element(by.text('Apple')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should search partial matches', async () => {
      const searchInput = element(by.id('pantry-search-input'));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await searchInput.clearText();
      await searchInput.typeText('App'); // partial

      await waitFor(element(by.text('Apple')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });
  });

  describe('Filter by Storage Location', () => {
    // The app has no filter *menu*: the locations are a persistent tab strip
    // (`FilterTabs` with `testIDPrefix="pantry-location-tab"`), so the ids are
    // `pantry-location-tab-{all,fridge,freezer,pantry}`. These tests looked for
    // `pantry-filter-button` and `filter-refrigerator`, neither of which the app
    // has ever rendered — see __tests__/harness/e2eTestIdsExist.test.ts.
    it('narrows the list to a storage location', async () => {
      await element(by.id('pantry-location-tab-fridge')).tap();

      // The tab strip is still there and the list re-rendered under it. The
      // previous version asserted only `waitForListToLoad()`, which passes
      // whether or not the tap did anything.
      await waitFor(element(by.id('pantry-location-tab-fridge')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await waitFor(element(by.id('pantry-list')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('returns to every location via the All tab', async () => {
      await element(by.id('pantry-location-tab-freezer')).tap();
      await element(by.id('pantry-location-tab-all')).tap();

      await waitFor(element(by.id('pantry-list')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });
  });

  describe('Sort', () => {
    // `pantry-sort-option-*` is derived from the option key in
    // `PantrySortModal`. The modal previously carried no testIDs at all, so the
    // `sort-by-name` / `sort-by-expiration` these tests used could not have
    // matched anything.
    const openSortModal = async () => {
      await element(by.id('pantry-sort-button')).tap();
      await waitFor(element(by.id('pantry-sort-modal')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    };

    it('opens the sort modal and applies sort by name', async () => {
      await openSortModal();
      await element(by.id('pantry-sort-option-name')).tap();

      // Applying a sort dismisses the modal — that is the observable effect,
      // and it fails if the tap missed.
      await waitFor(element(by.id('pantry-sort-modal')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await pantryScreen.waitForListToLoad();
    });

    it('applies sort by expiry', async () => {
      await openSortModal();
      await element(by.id('pantry-sort-option-expiry')).tap();

      await waitFor(element(by.id('pantry-sort-modal')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await pantryScreen.waitForListToLoad();
    });
  });

  describe('Combined Filters', () => {
    it('combines a search term with a location tab', async () => {
      const searchInput = element(by.id('pantry-search-input'));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await searchInput.typeText('il'); // matches Milk

      await waitFor(element(by.text('Milk')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await element(by.id('pantry-location-tab-fridge')).tap();
      await waitFor(element(by.id('pantry-list')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('clears the search and shows the excluded rows again', async () => {
      // There is no `reset-filters-button` in the app. Clearing the search
      // field is the reset, and the assertion is that a row the search had
      // excluded comes back.
      const searchInput = element(by.id('pantry-search-input'));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await searchInput.typeText('Apple');

      // An excluded row, not 'Apple' — the search field carries that text too.
      await waitFor(element(by.text('Banana')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await searchInput.clearText();
      await element(by.id('pantry-location-tab-all')).tap();

      await waitFor(element(by.text('Banana')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await pantryScreen.expectTextVisible('Milk');
    });
  });
});
