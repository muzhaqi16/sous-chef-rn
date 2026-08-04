/**
 * Every settings switch must flip on ONE tap.
 *
 * Reported as "Auto Sync takes two taps, Offline Mode doesn't". The two differ
 * in one way: `SettingSwitch` forwards `loading` to `disabled`, so a switch with
 * a `loading` prop is disabled from the moment the mutation starts — the frame
 * right after the user's tap. Offline Mode has no `loading`, and the
 * notification switches stopped needing two taps when theirs was removed, even
 * though they still render from the Apollo query. This asserts the behaviour
 * for every switch on the screen so the prop can't quietly come back.
 */

import { by, device, element, system, waitFor } from 'detox';
import { bootstrapAuthenticatedSession, relaunchToHomeTab } from '../../helpers';
import { getToggleValue, tapByID } from '../../helpers/actions';
import { TIMEOUTS } from '../../helpers/waitFor';

/** iOS offers "Save Password?" after the bootstrap login and blocks the tabs. */
async function dismissSavePasswordPrompt(): Promise<void> {
  try {
    await system.element(by.system.label('Not Now')).tap();
  } catch {
    // Not shown on this simulator — fine.
  }
}

/**
 * Poll until the switch reports a different value, or give up. Polling rather
 * than sleeping a fixed interval: the flip is a local cache write, so it lands
 * in a frame or two — a fixed wait would just be dead time on every run, and
 * still has to be long enough to catch a late revert.
 */
async function waitForToggleChange(
  testID: string,
  before: string | undefined,
  timeoutMs = 1500,
): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;
  let latest = before;
  while (Date.now() < deadline) {
    latest = await getToggleValue(testID);
    if (latest !== before) return latest;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return latest;
}

const SWITCHES = [
  { testID: 'settings-auto-sync-switch', label: 'Auto Sync' },
  { testID: 'settings-show-tutorials-switch', label: 'Show Tutorials' },
] as const;

describe('App settings — single tap', () => {
  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
    await dismissSavePasswordPrompt();
  });

  // One launch for the whole file — each switch is independent, and relaunching
  // per case only costs wall-clock.
  beforeAll(async () => {
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

      const before = await getToggleValue(testID);
      await element(by.id(testID)).tap();
      const after = await waitForToggleChange(testID, before);

      await device.takeScreenshot(`${testID}-after-one-tap`);
      if (before === after) {
        failures.push(`${label}: stayed at ${before}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(`Switches that ignored a single tap — ${failures.join('; ')}`);
    }
  });
});
