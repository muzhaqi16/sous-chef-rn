'use no memo';

// Mock tokenScheduler and refreshToken to break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockCreateFromTemplateMutation = jest.fn();
const mockCreateTemplateMutation = jest.fn();
const mockDeleteTemplateMutation = jest.fn();
const mockDuplicateTemplateMutation = jest.fn();

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useMutation: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'CreateMealPlanFromTemplate')
      return [mockCreateFromTemplateMutation, { loading: false }];
    if (opName === 'CreateTemplateFromMealPlan')
      return [mockCreateTemplateMutation, { loading: false }];
    if (opName === 'DeleteMealTemplate')
      return [mockDeleteTemplateMutation, { loading: false }];
    if (opName === 'DuplicateTemplate')
      return [mockDuplicateTemplateMutation, { loading: false }];
    return [jest.fn(), {}];
  }),
}));

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

import { renderHook } from '@testing-library/react-native';
import { useMealTemplateActions } from '../useMealTemplateActions';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';

describe('useMealTemplateActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all action functions and loading states', () => {
    const { result } = renderHook(() => useMealTemplateActions());

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
    mockCreateFromTemplateMutation.mockResolvedValue({
      data: {
        createMealPlanFromTemplate: { success: true },
      },
    });

    const { result } = renderHook(() => useMealTemplateActions());

    const response = await result.current.createPlanFromTemplate({
      templateId: 'template-1',
      startDate: '2025-01-01',
    });

    expect(response).toEqual({ success: true });
    expect(toastService.success).toHaveBeenCalledWith(
      'Meal plan created from template!',
    );
    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'meal_plan_created_from_template',
      {
        template_id: 'template-1',
      },
    );
  });

  it('createPlanFromTemplate returns null when mutation returns falsy', async () => {
    mockCreateFromTemplateMutation.mockResolvedValue({
      data: { createMealPlanFromTemplate: null },
    });

    const { result } = renderHook(() => useMealTemplateActions());

    const response = await result.current.createPlanFromTemplate({
      templateId: 't1',
      startDate: '2025-01-01',
    });

    expect(response).toBeNull();
  });

  it('createTemplateFromPlan shows success toast on success', async () => {
    mockCreateTemplateMutation.mockResolvedValue({
      data: {
        createTemplateFromMealPlan: { success: true },
      },
    });

    const { result } = renderHook(() => useMealTemplateActions());

    const response = await result.current.createTemplateFromPlan({
      mealPlanId: 'plan-1',
      name: 'My Template',
    });

    expect(response).toEqual({ success: true });
    expect(toastService.success).toHaveBeenCalledWith(
      'Meal plan saved as template!',
    );
    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'template_created_from_meal_plan',
      {
        meal_plan_id: 'plan-1',
      },
    );
  });

  it('deleteTemplate returns true and shows toast on success', async () => {
    mockDeleteTemplateMutation.mockResolvedValue({
      data: { deleteMealTemplate: { success: true } },
    });

    const { result } = renderHook(() => useMealTemplateActions());

    const success = await result.current.deleteTemplate('template-1');

    expect(success).toBe(true);
    expect(toastService.success).toHaveBeenCalledWith('Template deleted');
  });

  it('deleteTemplate returns false when mutation fails', async () => {
    mockDeleteTemplateMutation.mockResolvedValue({
      data: { deleteMealTemplate: { success: false } },
    });

    const { result } = renderHook(() => useMealTemplateActions());

    const success = await result.current.deleteTemplate('template-1');

    expect(success).toBe(false);
  });

  it('duplicateTemplate shows success toast on success', async () => {
    mockDuplicateTemplateMutation.mockResolvedValue({
      data: { duplicateTemplate: { success: true, id: 'dup-1' } },
    });

    const { result } = renderHook(() => useMealTemplateActions());

    const response = await result.current.duplicateTemplate(
      'template-1',
      'Copy of Template',
    );

    expect(response).toEqual({ success: true, id: 'dup-1' });
    expect(toastService.success).toHaveBeenCalledWith('Template duplicated!');
  });

  it('returns null when mutation throws (executeMutation returns false)', async () => {
    mockCreateFromTemplateMutation.mockRejectedValue(
      new Error('Network error'),
    );

    const { result } = renderHook(() => useMealTemplateActions());

    const response = await result.current.createPlanFromTemplate({
      templateId: 't1',
      startDate: '2025-01-01',
    });

    expect(response).toBeNull();
    expect(Telemetry.trackError).toHaveBeenCalled();
  });
});
