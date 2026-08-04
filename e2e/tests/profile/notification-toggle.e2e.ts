/**
 * Does a notification toggle flip on ONE tap?
 *
 * Reported as "have to tap it twice". The interesting part is measurable: read
 * the switch's own value before and after a single tap. On iOS a switch reports
 * `value` as '1' / '0', so a tap that doesn't change it is the bug reproducing.
 *
 * Also screenshots both states into e2e/artifacts so the run is reviewable.
 */

import { by, device, element, system, waitFor } from 'detox';
import { bootstrapAuthenticatedSession, relaunchToHomeTab } from '../../helpers';
import { tapByID } from '../../helpers/actions';
import { TIMEOUTS } from '../../helpers/waitFor';

/**
 * iOS offers "Save Password?" after the bootstrap login. It's a system alert,
 * so it sits above the app and makes the tab bar unhittable.
 */
async function dismissSavePasswordPrompt(): Promise<void> {
  try {
    await system.element(by.system.label('Not Now')).tap();
  } catch {
    // Not shown (already dismissed on this simulator) — fine.
  }
}

/** iOS switch attributes expose `value` as '1' | '0'. */
async function switchValue(testID: string): Promise<string | undefined> {
  const attrs = (await element(by.id(testID)).getAttributes()) as {
    value?: string;
  };
  return attrs.value;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Notification settings — single tap', () => {
  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
    await dismissSavePasswordPrompt();
  });

  it('flips a toggle on one tap', async () => {
    await dismissSavePasswordPrompt();
    await relaunchToHomeTab();
    await tapByID('tab-profile');
    await tapByID('profile-menu-notifications');

    const target = 'notification-switch-emailEnabled';
    await waitFor(element(by.id(target)))
      .toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);

    const before = await switchValue(target);
    await device.takeScreenshot('01-before-tap');
    console.log(`[toggle-test] before=${before}`);

    await element(by.id(target)).tap();
    // Long enough for the mutation to resolve (or be queued) and any revert to
    // land — a value that flips and comes back is the failure we're hunting.
    await delay(2500);

    const afterOne = await switchValue(target);
    await device.takeScreenshot('02-after-one-tap');
    console.log(`[toggle-test] afterOneTap=${afterOne}`);

    // Second tap, to record what the "it works on the second one" path does.
    await element(by.id(target)).tap();
    await delay(2500);
    const afterTwo = await switchValue(target);
    await device.takeScreenshot('03-after-two-taps');
    console.log(`[toggle-test] afterTwoTaps=${afterTwo}`);

    console.log(
      `[toggle-test] RESULT before=${before} afterOne=${afterOne} afterTwo=${afterTwo}`,
    );
    if (before === afterOne) {
      throw new Error(
        `Toggle did not change on a single tap (before=${before}, afterOne=${afterOne}, afterTwo=${afterTwo})`,
      );
    }
  });
});
