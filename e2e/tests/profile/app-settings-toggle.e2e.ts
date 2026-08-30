/**
 * Every settings switch must flip on ONE tap. `SettingSwitch` hands `loading` to
 * `BaseSwitch`, which ORs it into `disabled` — so a switch given a `loading`
 * prop goes disabled from the frame right after the user's tap and eats the
 * next one. Asserted for every switch so the prop can't quietly come back.
 */

import { by, element, waitFor } from 'detox';
import { bootstrapAuthenticatedSession } from '../../helpers/auth';
import { relaunchToHomeTab } from '../../helpers/flows';
import {
  dismissSavePasswordPrompt,
  tapByID,
  tapToggleOnce,
} from '../../helpers/actions';
import { TIMEOUTS } from '../../helpers/waitFor';

const SWITCHES = [
  { testID: 'settings-auto-sync-switch', label: 'Auto Sync' },
  { testID: 'settings-show-tutorials-switch', label: 'Show Tutorials' },
];

describe('App settings — single tap', () => {
  // One launch for the whole file — each switch is independent, and relaunching
  // per case only costs wall-clock.
  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
    await dismissSavePasswordPrompt();
    await relaunchToHomeTab();
    await tapByID('tab-profile');
    await tapByID('profile-menu-appSettings');
    // The screen renders a loading branch (no testID) until GetUserSettings
    // resolves, so wait for a switch rather than the container.
    await waitFor(element(by.id(SWITCHES[0].testID)))
      .toBeVisible()
      .withTimeout(TIMEOUTS.NETWORK);
  });

  it('every switch flips on one tap', async () => {
    const failures: string[] = [];

    for (const { testID, label } of SWITCHES) {
      await waitFor(element(by.id(testID)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      const { before, after } = await tapToggleOnce(testID);
      if (before === after) {
        failures.push(`${label}: stayed at ${before}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Switches that ignored a single tap — ${failures.join('; ')}`,
      );
    }
  });
});
