'use no memo';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/services/toastService', () => ({
  toastService: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackEvent: jest.fn(),
    trackError: jest.fn(),
  },
}));

// Stub the connection updater so the online success path doesn't need a fully
// modeled cache shape — the offline guard is what's under test here.
jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToQueryConnectionUpdater: jest.fn(() => jest.fn()),
}));

import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { DuplicateMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';
import { useDuplicateMealPlan } from '../useDuplicateMealPlan';

function duplicateMock() {
  return recordMock(DuplicateMealPlanDocument, {
    data: {
      duplicateMealPlan: {
        __typename: 'DuplicateMealPlanPayload',
        mealPlan: { __typename: 'MealPlan', id: 'plan-copy-1' },
      },
    },
  });
}

const input = {
  mealPlanId: 'plan-1',
  newName: 'Copy of Plan',
  newStartDate: '2025-01-01',
  newEndDate: '2025-01-07',
};

describe('useDuplicateMealPlan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when the API is unavailable', () => {
    afterEach(() => {
      useStore.setState({ apiReachable: true, isOnline: true });
    });

    it('exposes isApiUnavailable, toasts, returns null, and skips the mutation', async () => {
      useStore.setState({ apiReachable: false });
      const dup = duplicateMock();
      const { result } = renderHookWithApollo(() => useDuplicateMealPlan(), {
        operationMocks: [dup.mock],
      });

      expect(result.current.isApiUnavailable).toBe(true);

      const response = await result.current.duplicatePlan(input);

      expect(response).toBeNull();
      expect(toastService.error).toHaveBeenCalledWith('Not available offline');
      expect(dup.fired).toHaveLength(0);
    });

    it('fires the mutation normally when online', async () => {
      const dup = duplicateMock();
      const { result } = renderHookWithApollo(() => useDuplicateMealPlan(), {
        operationMocks: [dup.mock],
      });

      expect(result.current.isApiUnavailable).toBe(false);

      await result.current.duplicatePlan(input);

      expect(dup.fired).toHaveLength(1);
    });
  });
});
