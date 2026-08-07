import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { GetMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { useMealPlan } from '../useMealPlan';

jest.mock('#/apollo/links/tokenScheduler');

describe('useMealPlan', () => {
  it('skips the detail query until the local-first create is acknowledged', async () => {
    // The row does not exist server-side yet, so this read could only come back
    // RESOURCE_NOT_FOUND.
    unconfirmedCreates.mark('plan-1');
    const get = recordMock(GetMealPlanDocument, {
      error: new Error('should not fire while unconfirmed'),
    });

    const { result } = renderHookWithApollo(() => useMealPlan('plan-1'), {
      operationMocks: [get.mock],
    });

    expect(get.fired).toHaveLength(0);
    expect(result.current.loading).toBe(false);

    // Acknowledgement is the fetch trigger: the server now has data to give.
    act(() => {
      unconfirmedCreates.confirm('plan-1');
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
