/**
 * A notification switch must flip on ONE tap — same assertion as
 * `app-settings-toggle.e2e.ts`, on the screen rendering from
 * `GetNotificationPreferences` rather than `GetUserSettings`. iOS reports the
 * value as '1'/'0'; `tapToggleOnce` polls, so a flip-then-revert still fails.
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
