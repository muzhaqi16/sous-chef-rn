/**
 * The gate that stops a permanently-refused subscription from being re-sent on
 * every reconnect.
 */
import {
  isSubscriptionRejected,
  markSubscriptionRejected,
  resetRejectedSubscriptions,
} from '../rejectedSubscriptions';
import { PantryEventsDocument } from '#features/pantry/graphql/pantry.generated';
import { HomeEventsDocument } from '#operations/home/home.generated';
import { NotificationEventsDocument } from '#features/notifications/graphql/notifications.generated';

beforeEach(() => {
  resetRejectedSubscriptions();
});

describe('rejectedSubscriptions', () => {
  it('reports the first mark only, so the error is logged once', () => {
    expect(markSubscriptionRejected(PantryEventsDocument)).toBe(true);
    expect(markSubscriptionRejected(PantryEventsDocument)).toBe(false);
  });

  it('closes the gate for the marked subscription alone', () => {
    markSubscriptionRejected(PantryEventsDocument);

    expect(isSubscriptionRejected(PantryEventsDocument)).toBe(true);
    // The connection is fine — every other operation on the socket keeps going.
    expect(isSubscriptionRejected(NotificationEventsDocument)).toBe(false);
  });

  it('notifies subscribers so `skip` flips on the next render', () => {
    const { useSubscriptionRejected } = require('../rejectedSubscriptions');
    expect(typeof useSubscriptionRejected).toBe('function');

    markSubscriptionRejected(HomeEventsDocument);
    expect(isSubscriptionRejected(HomeEventsDocument)).toBe(true);

    resetRejectedSubscriptions();
    expect(isSubscriptionRejected(HomeEventsDocument)).toBe(false);
  });
});
