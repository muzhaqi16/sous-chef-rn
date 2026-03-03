import { renderHook, act } from '@testing-library/react-native';
import { useMealPlanActions } from '../useMealPlanActions';

const mockCreateMutation = jest.fn();
const mockUpdateMutation = jest.fn();
const mockDeleteMutation = jest.fn();

jest.mock('#generated', () => ({
  useCreateMealPlanMutation: jest.fn(() => [mockCreateMutation, { loading: false }]),
  useUpdateMealPlanMutation: jest.fn(() => [mockUpdateMutation, { loading: false }]),
  useDeleteMealPlanMutation: jest.fn(() => [mockDeleteMutation, { loading: false }]),
  GetMealPlansDocument: 'GetMealPlansDocument',
  SortOrder: { Desc: 'DESC', Asc: 'ASC' },
}));

// Break circular dependency
jest.mock('../../../apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useMealPlanActions', () => {
  it('returns loading states all false initially', () => {
    const { result } = renderHook(() => useMealPlanActions());

    expect(result.current.loading).toBe(false);
    expect(result.current.creating).toBe(false);
    expect(result.current.updating).toBe(false);
    expect(result.current.deleting).toBe(false);
  });

  it('createMealPlan calls mutation and returns data', async () => {
    const expectedPlan = { id: 'plan-1', name: 'Week Plan' };
    mockCreateMutation.mockResolvedValueOnce({
      data: { createMealPlan: expectedPlan },
    });

    const { result } = renderHook(() => useMealPlanActions());

    let created: any;
    await act(async () => {
      created = await result.current.createMealPlan({
        name: 'Week Plan',
        startDate: '2025-06-01',
        endDate: '2025-06-07',
      } as any);
    });

    expect(created).toEqual(expectedPlan);
    expect(mockCreateMutation).toHaveBeenCalledWith({
      variables: {
        input: {
          name: 'Week Plan',
          startDate: '2025-06-01',
          endDate: '2025-06-07',
        },
      },
    });
  });

  it('createMealPlan returns null when mutation returns no data', async () => {
    mockCreateMutation.mockResolvedValueOnce({
      data: { createMealPlan: null },
    });

    const { result } = renderHook(() => useMealPlanActions());

    let created: any;
    await act(async () => {
      created = await result.current.createMealPlan({
        name: 'X',
        startDate: '2025-06-01',
        endDate: '2025-06-07',
      } as any);
    });

    expect(created).toBeNull();
  });

  it('updateMealPlan calls mutation with id and input', async () => {
    mockUpdateMutation.mockResolvedValueOnce({
      data: { updateMealPlan: { id: 'plan-1', name: 'Updated' } },
    });

    const { result } = renderHook(() => useMealPlanActions());

    let updated: any;
    await act(async () => {
      updated = await result.current.updateMealPlan('plan-1', { name: 'Updated' } as any);
    });

    expect(updated).toEqual({ id: 'plan-1', name: 'Updated' });
    expect(mockUpdateMutation).toHaveBeenCalledWith({
      variables: { id: 'plan-1', input: { name: 'Updated' } },
    });
  });

  it('deleteMealPlan returns true on success', async () => {
    mockDeleteMutation.mockResolvedValueOnce({
      data: { deleteMealPlan: { success: true } },
    });

    const { result } = renderHook(() => useMealPlanActions());

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteMealPlan('plan-1');
    });

    expect(deleted).toBe(true);
    expect(mockDeleteMutation).toHaveBeenCalledWith({
      variables: { id: 'plan-1' },
    });
  });

  it('deleteMealPlan returns false on failure', async () => {
    mockDeleteMutation.mockResolvedValueOnce({
      data: { deleteMealPlan: { success: false } },
    });

    const { result } = renderHook(() => useMealPlanActions());

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteMealPlan('plan-1');
    });

    expect(deleted).toBe(false);
  });
});
