/**
 * A notification switch must flip on ONE tap.
 *
 * Same assertion as `app-settings-toggle.e2e.ts` and the same root cause
 * (`SettingSwitch` forwarded `loading` to `disabled`), on the other screen —
 * this one renders from `GetNotificationPreferences` rather than
 * `GetUserSettings`, so it exercises the second of the two settings hooks.
 *
 * Reported as "have to tap it twice", and the report is directly measurable:
 * read the switch's own value before and after a single tap. iOS reports it as
 * '1' / '0'. `tapToggleOnce` polls for the change rather than sleeping, so a
 * value that flips and then reverts still fails.
 */

import { by, element, waitFor } from 'detox';
import { bootstrapAuthenticatedSession, relaunchToHomeTab } from '../../helpers';
import {
  dismissSavePasswordPrompt,
  tapByID,
  tapToggleOnce,
} from '../../helpers/actions';
import { TIMEOUTS } from '../../helpers/waitFor';

const TARGET = 'notification-switch-emailEnabled';

describe('Notification settings — single tap', () => {
  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
    await dismissSavePasswordPrompt();
    await relaunchToHomeTab();
    await tapByID('tab-profile');
    await tapByID('profile-menu-notifications');
    await waitFor(element(by.id(TARGET)))
      .toBeVisible()
      .withTimeout(TIMEOUTS.NETWORK);
  });

  it('flips a toggle on one tap', async () => {
    const { before, after } = await tapToggleOnce(TARGET);

    if (before === after) {
      throw new Error(
        `Toggle did not change on a single tap (stayed at ${before})`,
      );
    }
  });
});
