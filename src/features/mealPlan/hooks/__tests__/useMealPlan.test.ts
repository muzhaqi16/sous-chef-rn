import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { GetMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { useMealPlan } from '../useMealPlan';

jest.mock('#/apollo/links/tokenScheduler');

describe('useMealPlan', () => {
  it('queries a marked id anyway — meal plans no longer have an unconfirmed window', async () => {
    // Creating a plan is online-only now: the id is the server's before any
    // screen reads it, so there is nothing to wait for. Only pantry and barcode
    // still mark ids, and this asserts the meal-plan read is not gated on a
    // marker that will never be set for it.
    unconfirmedCreates.mark('plan-1');
    const get = recordMock(GetMealPlanDocument, {
      error: new Error('network unavailable'),
    });

    renderHookWithApollo(() => useMealPlan('plan-1'), {
      operationMocks: [get.mock],
    });

    await waitFor(() => expect(get.fired).toContainEqual({ id: 'plan-1' }));
  });

  it('queries immediately for a plan the server already knows', async () => {
    const get = recordMock(GetMealPlanDocument, {
      error: new Error('network unavailable'),
    });

    renderHookWithApollo(() => useMealPlan('plan-2'), {
      operationMocks: [get.mock],
    });

    await waitFor(() => expect(get.fired).toContainEqual({ id: 'plan-2' }));
  });

  it('skips entirely when there is no active plan', () => {
    const get = recordMock(GetMealPlanDocument, {
      error: new Error('should not fire without an id'),
    });

    const { result } = renderHookWithApollo(() => useMealPlan(null), {
      operationMocks: [get.mock],
    });

    expect(get.fired).toHaveLength(0);
    expect(result.current.mealPlan).toBeNull();
    expect(result.current.items).toEqual([]);
  });
});
