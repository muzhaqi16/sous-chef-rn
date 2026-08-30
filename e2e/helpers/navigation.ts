import { waitForScreen } from './waitFor';
import { tapByID } from './actions';

export async function navigateToTab(tabName: string) {
  await tapByID(`tab-${tabName}`);
  await waitForScreen(`${tabName}-screen`);
}

export async function navigateToShoppingList() {
  await navigateToTab('shoppinglist');
}

export async function navigateToPantry() {
  await navigateToTab('pantry');
}

export async function navigateToRecipes() {
  await navigateToTab('recipes');
}

export async function navigateToProfile() {
  await navigateToTab('profile');
}

export async function goBack() {
  if (device.getPlatform() === 'ios') {
    await tapByID('header-back-button');
  } else {
    await device.pressBack();
  }
}

export async function openSettings() {
  await navigateToProfile();
  await tapByID('profile-menu-appSettings');
  await waitForScreen('settings-screen');
}

export async function openScanner() {
  await tapByID('scanner-button');
  await waitForScreen('scanner-screen');
}

export async function openItemSelector(selectorID: string = 'item-selector') {
  await tapByID(`${selectorID}-button`);
  await waitFor(element(by.id(selectorID))).toBeVisible().withTimeout(5000);
}

export async function closeItemSelector(selectorID: string = 'item-selector') {
  await tapByID(`${selectorID}-close-button`);
  await waitFor(element(by.id(selectorID))).not.toBeVisible().withTimeout(5000);
}

/** Waits for an already-presented modal; it does not open one. */
export async function openModal(modalID: string) {
  await waitFor(element(by.id(modalID))).toBeVisible().withTimeout(5000);
}

export async function closeModal(modalID: string) {
  await tapByID(`${modalID}-close-button`);
  await waitFor(element(by.id(modalID))).not.toBeVisible().withTimeout(5000);
}

export async function navigateToHome() {
  // Back out repeatedly: the screen may be nested several levels deep.
  for (let i = 0; i < 5; i++) {
    try {
      await waitForScreen('home-screen', 1000);
      return;
    } catch {
      await goBack();
    }
  }
}
