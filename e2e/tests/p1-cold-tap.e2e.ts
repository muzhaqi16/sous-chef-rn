/**
 * P1 verification: cold-launch notification tap routing.
 *
 * Bootstraps an authenticated session first (token-inject with UI-login
 * fallback — the persisted session survives relaunches), then launches a NEW
 * app instance with a userNotification (Detox's simulation of launching the
 * app by tapping a push) carrying `category: SHOPPING` and asserts the app
 * lands on the Shopping List screen instead of the default Pantry tab.
 * Exercises PushNotificationForwarder's tap cache / InitialNotificationTap
 * consume and NavigationService's pending-navigation flush on container ready.
 *
 * The follow-up plain launch asserts the one-shot semantics: no stale tap
 * replays on the next cold start.
 */
import { element, by, waitFor } from 'detox';
import { launchAppWithFabricWorkaround } from '../init';
import { bootstrapAuthenticatedSession } from '../helpers/auth';

const SHOPPING_TAP_NOTIFICATION = {
  trigger: { type: 'push' },
  title: 'Shopping list updated',
  body: 'A housemate added items to your list',
  payload: {
    category: 'SHOPPING',
  },
};

describe('P1: cold-launch notification tap', () => {
  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
  });

  it('routes a killed-app tap with category SHOPPING to the shopping list', async () => {
    await launchAppWithFabricWorkaround({
      newInstance: true,
      permissions: { notifications: 'YES' },
      userNotification: SHOPPING_TAP_NOTIFICATION,
    });

    await waitFor(element(by.id('shopping-list-screen')))
      .toBeVisible()
      .withTimeout(20000);

    await device.takeScreenshot('cold-tap-landed-on-shopping-list');
  });

  it('does not replay the tap on the next plain cold launch (one-shot cache)', async () => {
    await launchAppWithFabricWorkaround({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });

    // Default post-login screen is the Pantry tab — a stale replayed tap
    // would put us on the shopping list instead.
    await waitFor(element(by.id('pantry-screen')))
      .toBeVisible()
      .withTimeout(20000);

    await device.takeScreenshot('plain-launch-landed-on-pantry');
  });
});
