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

import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  CreateMealPlanFromTemplateDocument,
  CreateTemplateFromMealPlanDocument,
  DeleteMealTemplateDocument,
  DuplicateTemplateDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import { useMealTemplateActions } from '../useMealTemplateActions';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';

describe('useMealTemplateActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all action functions and loading states', () => {
    const { result } = renderHookWithApollo(() => useMealTemplateActions());

    expect(result.current).toHaveProperty('createPlanFromTemplate');
    expect(result.current).toHaveProperty('createTemplateFromPlan');
    expect(result.current).toHaveProperty('deleteTemplate');
    expect(result.current).toHaveProperty('duplicateTemplate');
    expect(result.current.loading).toBe(false);
    expect(result.current.creatingFromTemplate).toBe(false);
    expect(result.current.creatingTemplate).toBe(false);
    expect(result.current.deleting).toBe(false);
    expect(result.current.duplicating).toBe(false);
  });

  it('createPlanFromTemplate shows success toast and tracks event on success', async () => {
    const create = recordMock(CreateMealPlanFromTemplateDocument, {
      data: {
        createMealPlanFromTemplate: {
          __typename: 'BasicPayload',
          success: true,
        },
      },
    });

    const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
      operationMocks: [create.mock],
    });

    const response = await result.current.createPlanFromTemplate({
      templateId: 'template-1',
      startDate: '2025-01-01',
    });

    expect(response).toMatchObject({ success: true });
    expect(toastService.success).toHaveBeenCalledWith(
      'Meal plan created from template!',
    );
    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'meal_plan_created_from_template',
      { template_id: 'template-1' },
    );
  });

  it('createPlanFromTemplate returns null when mutation returns falsy', async () => {
    const create = recordMock(CreateMealPlanFromTemplateDocument, {
      data: { createMealPlanFromTemplate: null },
    });

    const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
      operationMocks: [create.mock],
    });

    const response = await result.current.createPlanFromTemplate({
      templateId: 't1',
      startDate: '2025-01-01',
    });

    expect(response).toBeNull();
  });

  it('createTemplateFromPlan shows success toast on success', async () => {
    const create = recordMock(CreateTemplateFromMealPlanDocument, {
      data: {
        createTemplateFromMealPlan: {
          __typename: 'BasicPayload',
          success: true,
        },
      },
    });

    const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
      operationMocks: [create.mock],
    });

    const response = await result.current.createTemplateFromPlan({
      mealPlanId: 'plan-1',
      name: 'My Template',
    });

    expect(response).toMatchObject({ success: true });
    expect(toastService.success).toHaveBeenCalledWith(
      'Meal plan saved as template!',
    );
    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'template_created_from_meal_plan',
      { meal_plan_id: 'plan-1' },
    );
  });

  it('deleteTemplate returns true and shows toast on success', async () => {
    const del = recordMock(DeleteMealTemplateDocument, {
      data: {
        deleteMealTemplate: { __typename: 'BasicPayload', success: true },
      },
    });

    const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
      operationMocks: [del.mock],
    });

    const success = await result.current.deleteTemplate('template-1');

    expect(success).toBe(true);
    expect(toastService.success).toHaveBeenCalledWith('Template deleted');
  });

  it('deleteTemplate returns false when mutation fails', async () => {
    const del = recordMock(DeleteMealTemplateDocument, {
      data: {
        deleteMealTemplate: { __typename: 'BasicPayload', success: false },
      },
    });

    const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
      operationMocks: [del.mock],
    });

    const success = await result.current.deleteTemplate('template-1');

    expect(success).toBe(false);
  });

  it('duplicateTemplate shows success toast on success', async () => {
    const dup = recordMock(DuplicateTemplateDocument, {
      data: {
        duplicateTemplate: {
          __typename: 'BasicPayload',
          success: true,
          id: 'dup-1',
        },
      },
    });

    const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
      operationMocks: [dup.mock],
    });

    const response = await result.current.duplicateTemplate(
      'template-1',
      'Copy of Template',
    );

    expect(response).toMatchObject({ success: true, id: 'dup-1' });
    expect(toastService.success).toHaveBeenCalledWith('Template duplicated!');
  });

  // NOTE on the legacy "returns null when mutation throws" test: it relied
  // on `mockMutation.mockRejectedValue(new Error(...))` which throws inside
  // the hook's try/catch, triggering its trackError branch. Apollo's
  // `errorPolicy: 'all'` (set by the test wrapper to surface errors as data)
  // means the real MockLink resolves to `{ data: undefined, error }` instead
  // of throwing — so this branch is unreachable from real Apollo. Error-path
  // coverage lives in the integration tests + executeMutation's own unit tests.
});
