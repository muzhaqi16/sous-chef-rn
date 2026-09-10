'use no memo';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/services/toastService', () => ({
  toastService: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('#/services/telemetry', () => ({
  Telemetry: { trackEvent: jest.fn(), trackError: jest.fn() },
}));

import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  CreateMealTemplateDocument,
  DeleteMealTemplateDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import { CreateMealPlanItemDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { UseMealTemplateActions_TemplateFragmentDoc } from '#features/mealPlan/hooks/useMealTemplateActions.generated';
import { useMealTemplateActions } from '../useMealTemplateActions';
import {
  ErrorCode,
  MealType,
  TemplateCategory,
} from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';

/**
 * Templates are copied from the cache, so these assert on what is SENT and on
 * the cache — the source template never leaves the device.
 */

const TEMPLATE_ID = 'template-1';

const template = {
  __typename: 'MealTemplate',
  id: TEMPLATE_ID,
  name: 'Weeknights',
  description: 'Quick dinners',
  category: TemplateCategory.Custom,
  durationDays: 3,
  defaultServings: 2,
  tags: ['quick'],
  homeId: 'home-1',
  items: [
    {
      __typename: 'MealTemplateItem',
      id: 'ti-1',
      dayOffset: 0,
      mealType: MealType.Dinner,
      servings: 2,
      notes: null,
      customMealName: null,
      recipe: { __typename: 'Recipe', id: 'recipe-1' },
    },
    {
      __typename: 'MealTemplateItem',
      id: 'ti-2',
      dayOffset: 2,
      mealType: MealType.Lunch,
      servings: null,
      notes: null,
      customMealName: 'Leftovers',
      recipe: null,
    },
  ],
};

const seeded = () =>
  seedCache([
    {
      data: template,
      fragment: UseMealTemplateActions_TemplateFragmentDoc,
      fragmentName: 'useMealTemplateActions_template',
    },
  ]);

const createTemplateMock = () =>
  recordMock(CreateMealTemplateDocument, {
    data: {
      createMealTemplate: {
        __typename: 'CreateMealTemplatePayload',
        mealTemplate: { __typename: 'MealTemplate', id: 'copy-1' },
      },
    },
    partial: true,
  });

const createItemMock = () =>
  recordMock(CreateMealPlanItemDocument, {
    data: {
      createMealPlanItem: {
        __typename: 'CreateMealPlanItemPayload',
        mealPlanItem: { __typename: 'MealPlanItem', id: 'meal-1' },
      },
    },
    partial: true,
  });

describe('useMealTemplateActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStore.setState({
      user: {
        id: 'user-1',
        email: 'a@b.c',
        displayName: 'A',
        emailVerified: true,
        onBoarded: true,
      },
    });
  });

  afterEach(() => {
    useStore.setState({ apiReachable: true, isOnline: true, user: null });
  });

  it('exposes the actions and their loading states, and no offline gate', () => {
    const { result } = renderHookWithApollo(() => useMealTemplateActions());

    expect(result.current).toHaveProperty('createPlanFromTemplate');
    expect(result.current).toHaveProperty('createTemplateFromPlan');
    expect(result.current).toHaveProperty('deleteTemplate');
    expect(result.current).toHaveProperty('duplicateTemplate');
    expect('isApiUnavailable' in result.current).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  describe('laying a template onto dates', () => {
    it('refuses when the template is not cached, without firing anything', async () => {
      const item = createItemMock();
      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [item.mock],
      });

      const response = await result.current.createPlanFromTemplate({
        templateId: TEMPLATE_ID,
        startDate: '2026-02-02T00:00:00.000Z',
      });

      expect(response).toBeNull();
      expect(item.fired).toHaveLength(0);
      expect(toastService.error).toHaveBeenCalled();
    });

    it('creates a meal per template item, offset from the chosen start', async () => {
      useStore.setState({ apiReachable: false });
      const item = createItemMock();
      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [item.mock],
        cache: seeded(),
      });

      const response = await result.current.createPlanFromTemplate({
        templateId: TEMPLATE_ID,
        startDate: '2026-02-02T00:00:00.000Z',
      });

      expect(response?.mealPlanId).toBeTruthy();
      const sent = item.fired as Array<{
        input: { date: string; mealPlanId: string };
      }>;
      expect(sent.map(f => f.input.date)).toEqual([
        '2026-02-02T00:00:00.000Z',
        '2026-02-04T00:00:00.000Z',
      ]);
      expect(sent.every(f => f.input.mealPlanId === response?.mealPlanId)).toBe(
        true,
      );
    });
  });

  describe('duplicating a template', () => {
    it('refuses when the template is not cached', async () => {
      const create = createTemplateMock();
      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [create.mock],
      });

      expect(
        await result.current.duplicateTemplate(TEMPLATE_ID, 'Copy'),
      ).toBeNull();
      expect(create.fired).toHaveLength(0);
    });

    it('sends one create carrying every copied item, offline', async () => {
      useStore.setState({ apiReachable: false });
      const create = createTemplateMock();
      const cache = seeded();
      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [create.mock],
        cache,
      });

      const response = await result.current.duplicateTemplate(
        TEMPLATE_ID,
        'Weeknights (Copy)',
      );

      expect(create.fired).toHaveLength(1);
      const sent = create.fired[0] as {
        input: { name: string; items: Array<{ dayOffset: number }> };
      };
      expect(sent.input.name).toBe('Weeknights (Copy)');
      expect(sent.input.items.map(i => i.dayOffset)).toEqual([0, 2]);

      // The copy is in the cache before any server round trip.
      expect(
        cache.extract()[`MealTemplate:${response?.mealTemplateId}`],
      ).toMatchObject({ name: 'Weeknights (Copy)' });
    });
  });

  describe('deleting a template', () => {
    it('returns true and toasts on success', async () => {
      const del = recordMock(DeleteMealTemplateDocument, {
        data: {
          deleteMealTemplate: {
            __typename: 'DeleteMealTemplatePayload',
            mealTemplate: { __typename: 'MealTemplate', id: TEMPLATE_ID },
          },
        },
      });

      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [del.mock],
      });

      expect(await result.current.deleteTemplate(TEMPLATE_ID)).toBe(true);
      expect(toastService.success).toHaveBeenCalledWith('Template deleted');
    });

    it('returns false when the mutation is refused', async () => {
      const del = recordMock(DeleteMealTemplateDocument, {
        data: {
          deleteMealTemplate: {
            __typename: 'NotFoundError',
            code: ErrorCode.NotFound,
            message: 'Template not found',
          },
        },
      });

      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [del.mock],
      });

      expect(await result.current.deleteTemplate(TEMPLATE_ID)).toBe(false);
    });
  });
});
