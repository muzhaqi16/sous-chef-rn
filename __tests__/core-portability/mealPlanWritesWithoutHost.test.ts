/**
 * The meal-plan writes the web planner calls, in node with every React Native
 * package unloadable: a recipe added to a plan lands in the cache and reaches
 * the API on the day it was dropped, removing it takes it out again, and each
 * outcome reaches the toast presenter the host registers.
 */
import { act, createElement } from 'react';
// The renderer React Native Testing Library runs every mobile suite on, which
// this project cannot load: it requires React Native.
import { create } from 'react-test-renderer';
import { MealType } from '#/graphql/generated/schemaTypes';
import {
  CreateMealPlanItemDocument,
  DeleteMealPlanItemDocument,
  GetMealPlansDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import { readPlanSource } from '#features/mealPlan/cache/derivationSources';
import { useAddRecipeToMealPlan } from '#features/mealPlan/hooks/useAddRecipeToMealPlan';
import { useMealPlanItemActions } from '#features/mealPlan/hooks/useMealPlanItemActions';
import { _setToastDispatch } from '#/services/toastService';
import type { ToastOptions } from '#platform/presenters';
import { useStore } from '#store';
import { toDateKey } from '#/utils/dateUtils';
import {
  createApolloTestWrapper,
  inputOf,
  recordMock,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  planSource,
  seedPlanSource,
} from '#/test-utils/fixtures/mealPlanFixtures';

// The mock provider's render helpers are React Native's; this suite renders
// with react-test-renderer and needs only its Apollo wrapper.
jest.mock('@testing-library/react-native', () => ({}));

const PLAN_ID = 'plan-1';

/** A day `offset` days from today, as the plan stores it. */
const dayFrom = (offset: number): Date => {
  const today = new Date();
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + offset,
  );
};
const WEEK = {
  startDate: toDateKey(dayFrom(0)),
  endDate: toDateKey(dayFrom(6)),
};

interface Planner {
  add: ReturnType<typeof useAddRecipeToMealPlan>;
  items: ReturnType<typeof useMealPlanItemActions>;
}

// Called on every render, so each assertion reads the latest hooks.
const rendered = jest.fn<void, [Planner]>();

function PlannerProbe() {
  rendered({
    add: useAddRecipeToMealPlan({ planId: PLAN_ID }),
    items: useMealPlanItemActions(PLAN_ID),
  });
  return null;
}

const current = (): Planner => {
  const [planner] = rendered.mock.lastCall ?? [];
  if (!planner) throw new Error('the probe has not rendered');
  return planner;
};

/** Lets the mocked network answer until `check` holds. */
async function until(check: () => boolean): Promise<void> {
  for (let tries = 0; tries < 50 && !check(); tries += 1) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  }
  expect(check()).toBe(true);
}

const plansMock = () =>
  recordMock(GetMealPlansDocument, {
    data: {
      mealPlans: { edges: [{ node: { id: PLAN_ID, ...WEEK } }] },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
  });

/** The server creating the meal under the id the client minted. */
const createMock = () =>
  recordMock(CreateMealPlanItemDocument, {
    dataFor: (vars): MockDataFor<typeof CreateMealPlanItemDocument> => ({
      createMealPlanItem: {
        __typename: 'CreateMealPlanItemPayload',
        mealPlanItem: {
          id: String(inputOf(vars).id),
          date: String(inputOf(vars).date),
        },
        mealPlan: { id: PLAN_ID, ...WEEK },
      },
    }),
  });

const deleteMock = () =>
  recordMock(DeleteMealPlanItemDocument, {
    dataFor: (vars): MockDataFor<typeof DeleteMealPlanItemDocument> => ({
      deleteMealPlanItem: {
        __typename: 'DeleteMealPlanItemPayload',
        mealPlanItem: { id: String(inputOf(vars).id) },
      },
    }),
  });

/** The plan's meals as [id, day]. */
const planMeals = (cache: ReturnType<typeof seedPlanSource>) =>
  readPlanSource(cache, PLAN_ID)?.mealPlanItems.map(meal => [
    meal.id,
    meal.date,
  ]);

beforeAll(() => {
  // react-test-renderer reports updates outside `act` unless told it is a test.
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

it('adds a recipe to a plan and removes it, with no React Native', async () => {
  useStore.getState().setAuth(
    {
      id: 'user-1',
      email: 'chef@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    'access-token',
    'refresh-token',
  );
  const toasts: ToastOptions[] = [];
  _setToastDispatch(toast => {
    toasts.push(toast);
  });
  const cache = seedPlanSource(
    planSource({ id: PLAN_ID, ...WEEK, mealPlanItems: [] }),
  );
  const added = createMock();
  const removed = deleteMock();
  const Wrapper = createApolloTestWrapper({
    operationMocks: [plansMock().mock, added.mock, removed.mock],
    cache,
  });

  await act(async () => {
    create(createElement(Wrapper, null, createElement(PlannerProbe)));
  });
  await until(() => current().add.hasPlan);

  const day = dayFrom(2);
  let addedOk = false;
  await act(async () => {
    addedOk = await current().add.addRecipeToMealPlan({
      recipeId: 'recipe-1',
      mealType: MealType.Dinner,
      date: day,
    });
  });

  expect(addedOk).toBe(true);
  const [sent] = added.fired;
  expect(sent).toEqual({
    input: {
      id: expect.any(String),
      mealPlanId: PLAN_ID,
      meal: { recipeId: 'recipe-1' },
      mealType: MealType.Dinner,
      date: toDateKey(day),
    },
  });
  const mealId = String(inputOf(sent ?? {}).id);
  expect(planMeals(cache)).toEqual([[mealId, toDateKey(day)]]);
  expect(toasts.map(toast => toast.type)).toEqual(['success']);

  let removedOk = false;
  await act(async () => {
    removedOk = await current().items.deleteItem(mealId);
  });

  expect(removedOk).toBe(true);
  expect(removed.fired).toEqual([{ input: { id: mealId } }]);
  expect(planMeals(cache)).toEqual([]);
});
