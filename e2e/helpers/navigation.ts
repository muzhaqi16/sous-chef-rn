/**
 * Navigation helpers for E2E tests
 *
 * Provides utilities for navigating between screens
 */

import { waitForScreen } from './waitFor';
import { tapByID } from './actions';

/**
 * Navigate to a tab by name
 */
export async function navigateToTab(tabName: string) {
  await tapByID(`tab-${tabName}`);
  await waitForScreen(`${tabName}-screen`);
}

/**
 * Navigate to Shopping List tab
 */
export async function navigateToShoppingList() {
  await navigateToTab('shopping-list');
}

/**
 * Navigate to Pantry tab
 */
export async function navigateToPantry() {
  await navigateToTab('pantry');
}

/**
 * Navigate to Recipes tab
 */
export async function navigateToRecipes() {
  await navigateToTab('recipes');
}

/**
 * Navigate to Profile tab
 */
export async function navigateToProfile() {
  await navigateToTab('profile');
}

/**
 * Go back using native back button
 */
export async function goBack() {
  if (device.getPlatform() === 'ios') {
    await tapByID('back-button');
  } else {
    await device.pressBack();
  }
}

/**
 * Open settings from profile
 */
export async function openSettings() {
  await navigateToProfile();
  await tapByID('settings-button');
  await waitForScreen('settings-screen');
}

/**
 * Navigate to scanner screen
 */
export async function openScanner() {
  await tapByID('scanner-button');
  await waitForScreen('scanner-screen');
}

/**
 * Open item selector/picker
 */
export async function openItemSelector(selectorID: string = 'item-selector') {
  await tapByID(`${selectorID}-button`);
  await waitFor(element(by.id(selectorID))).toBeVisible().withTimeout(5000);
}

/**
 * Close item selector/picker
 */
export async function closeItemSelector(selectorID: string = 'item-selector') {
  await tapByID(`${selectorID}-close-button`);
  await waitFor(element(by.id(selectorID))).not.toBeVisible().withTimeout(5000);
}

/**
 * Open modal
 */
export async function openModal(modalID: string) {
  await waitFor(element(by.id(modalID))).toBeVisible().withTimeout(5000);
}

/**
 * Close modal
 */
export async function closeModal(modalID: string) {
  await tapByID(`${modalID}-close-button`);
  await waitFor(element(by.id(modalID))).not.toBeVisible().withTimeout(5000);
}

/**
 * Navigate to home screen
 */
export async function navigateToHome() {
  // Try multiple times in case we're nested deep
  for (let i = 0; i < 5; i++) {
    try {
      await waitForScreen('home-screen', 1000);
      return;
    } catch {
      await goBack();
    }
  }
}
