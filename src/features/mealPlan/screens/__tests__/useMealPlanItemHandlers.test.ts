import { act, renderHook } from '@testing-library/react-native';
import type { ActiveMealPlan } from '../useActiveMealPlan';
import { useMealPlanItemHandlers } from '../useMealPlanItemHandlers';

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#features/mealPlan/hooks/useMealPlanItemActions', () => ({
  useMealPlanItemActions: () => ({
    createItem: jest.fn(),
    toggleCompleted: jest.fn(),
    deleteItem: jest.fn(),
  }),
}));

type PlanItem = ActiveMealPlan['itemDetails'][number];

/** A recipe meal on the plan, at the version the plan last read. */
const recipeMeal = (version: number): PlanItem =>
  ({
    id: 'mpi-1',
    version,
    servings: 2,
    cookingLogId: null,
    recipe: { id: 'recipe-1', name: 'Chili', servings: 4 },
  } as Partial<PlanItem> as PlanItem);

const planWith = (item: PlanItem): ActiveMealPlan =>
  ({
    activePlanId: 'plan-1',
    itemDetails: [item],
  } as Partial<ActiveMealPlan> as ActiveMealPlan);

const sheets = { active: null, open: jest.fn(), close: jest.fn() };

// The cook's version is the meal's as the plan now holds it: a conflict
// refetches the plan, and the next confirm must send what it brought.
describe('useMealPlanItemHandlers', () => {
  it('cooks the meal at the version the plan holds now, not when it opened', () => {
    let plan = planWith(recipeMeal(2));
    const { result, rerender } = renderHook(() =>
      useMealPlanItemHandlers({ plan, selectedDate: new Date(), sheets }),
    );

    act(() => result.current.toggle('mpi-1', false, true));
    expect(result.current.pendingCook?.version).toBe(2);

    plan = planWith(recipeMeal(3));
    rerender({});

    expect(result.current.pendingCook).toMatchObject({
      id: 'mpi-1',
      version: 3,
    });
  });
});
