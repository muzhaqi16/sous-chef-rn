/**
 * P1: cold-launch notification tap routing. Detox's `userNotification`
 * simulates launching by tapping a push; `category: SHOPPING` must land on
 * Shopping List, not Pantry — exercising PushNotificationForwarder's tap cache
 * and NavigationService's pending-nav flush. Relaunch pins one-shot semantics.
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
