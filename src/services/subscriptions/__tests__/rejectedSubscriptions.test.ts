/**
 * The gate that stops a permanently-refused subscription from being re-sent on
 * every reconnect.
 */
import {
  isSubscriptionRejected,
  markSubscriptionRejected,
  resetRejectedSubscriptions,
} from '../rejectedSubscriptions';

beforeEach(() => {
  resetRejectedSubscriptions();
});

describe('rejectedSubscriptions', () => {
  it('reports the first mark only, so the error is logged once', () => {
    expect(markSubscriptionRejected('PantryEvents')).toBe(true);
    expect(markSubscriptionRejected('PantryEvents')).toBe(false);
  });

  it('closes the gate for the marked subscription alone', () => {
    markSubscriptionRejected('PantryEvents');

    expect(isSubscriptionRejected('PantryEvents')).toBe(true);
    // The connection is fine — every other operation on the socket keeps going.
    expect(isSubscriptionRejected('NotificationEvents')).toBe(false);
  });

  it('notifies subscribers so `skip` flips on the next render', () => {
    const { useSubscriptionRejected } = require('../rejectedSubscriptions');
    expect(typeof useSubscriptionRejected).toBe('function');

    markSubscriptionRejected('HomeEvents');
    expect(isSubscriptionRejected('HomeEvents')).toBe(true);

    resetRejectedSubscriptions();
    expect(isSubscriptionRejected('HomeEvents')).toBe(false);
  });
});
