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
    it('should filter by storage location', async () => {
      const filterButton = element(by.id('pantry-filter-button'));
      await waitFor(filterButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await filterButton.tap();

      // Select a storage location filter
      const storageFilter = element(by.id('filter-refrigerator'));
      await waitFor(storageFilter).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await storageFilter.tap();

      // Should show only refrigerated items
      await pantryScreen.waitForListToLoad();
    });

    it('should show all locations option', async () => {
      const filterButton = element(by.id('pantry-filter-button'));
      await waitFor(filterButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await filterButton.tap();

      // Look for "All Locations" option
      const allLocations = element(by.id('filter-all-locations'));
      await waitFor(allLocations).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
    });
  });

  describe('Sort', () => {
    it('should sort by name', async () => {
      const sortButton = element(by.id('pantry-sort-button'));
      await waitFor(sortButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await sortButton.tap();

      const sortByName = element(by.id('sort-by-name'));
      await waitFor(sortByName).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await sortByName.tap();

      // Items should now be sorted alphabetically
      await pantryScreen.waitForListToLoad();
    });

    it('should sort by expiration date', async () => {
      const sortButton = element(by.id('pantry-sort-button'));
      await waitFor(sortButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await sortButton.tap();

      const sortByExpiration = element(by.id('sort-by-expiration'));
      await waitFor(sortByExpiration)
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await sortByExpiration.tap();

      await pantryScreen.waitForListToLoad();
    });
  });

  describe('Combined Filters', () => {
    it('should combine search and location filter', async () => {
      // First apply search
      const searchInput = element(by.id('pantry-search-input'));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await searchInput.typeText('il'); // matches Milk

      await waitFor(element(by.text('Milk')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Then apply filter
      const filterButton = element(by.id('pantry-filter-button'));
      await filterButton.tap();

      const storageFilter = element(by.id('filter-refrigerator'));
      await waitFor(storageFilter).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await storageFilter.tap();

      // Should show items matching both criteria
      await pantryScreen.waitForListToLoad();
    });

    it('should reset all filters', async () => {
      // Apply some filters first
      const searchInput = element(by.id('pantry-search-input'));
      await waitFor(searchInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await searchInput.typeText('Apple');

      // An excluded row, not 'Apple' — the search field carries that text too.
      await waitFor(element(by.text('Banana')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Find and tap reset/clear button
      const resetButton = element(by.id('reset-filters-button'));
      await waitFor(resetButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await resetButton.tap();

      // All items should be visible again
      await waitFor(element(by.text('Banana')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await pantryScreen.expectTextVisible('Milk');
    });
  });

  describe('Expiring Items', () => {
    it('should show expiring soon section', async () => {
      await waitFor(element(by.id('expiring-soon-section')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should navigate to low stock view', async () => {
      const lowStockButton = element(by.id('low-stock-button'));
      await waitFor(lowStockButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await lowStockButton.tap();

      // Should show low stock items screen
      await waitFor(element(by.id('low-stock-items-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });
  });
});
