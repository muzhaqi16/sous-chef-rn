'use no memo';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/services/toastService', () => ({
  toastService: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import { gql, type InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type QueryDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  CreateMealTemplateDocument,
  DeleteMealTemplateDocument,
  GetMealTemplateDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import {
  CreateMealPlanDocument,
  CreateMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import { UseDuplicateMealPlan_MealPlanFragmentDoc } from '#features/mealPlan/hooks/useDuplicateMealPlan.generated';
import { MealPlanMain_MealPlanFragmentDoc } from '#features/mealPlan/screens/MealPlanMain.generated';
import { readTemplateSource } from '#features/mealPlan/cache/derivationSources';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import { useMealTemplateActions } from '../useMealTemplateActions';
import {
  ErrorCode,
  MealPlanType,
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

/** The template as the server answers `GetMealTemplate`, which is what caches it. */
const template = (
  hasNextPage: boolean = false,
): QueryDataFor<typeof GetMealTemplateDocument> => ({
  __typename: 'Query',
  mealTemplate: {
    __typename: 'MealTemplate',
    id: TEMPLATE_ID,
    name: 'Weeknights',
    description: 'Quick dinners',
    category: TemplateCategory.Custom,
    durationDays: 3,
    defaultServings: 2,
    tags: ['quick'],
    usageCount: 0,
    lastUsedAt: null,
    homeId: 'home-1',
    home: null,
    user: { __typename: 'User', id: 'user-1' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    itemsConnection: {
      __typename: 'MealTemplateItemConnection',
      totalCount: 2,
      pageInfo: {
        __typename: 'PageInfo',
        hasNextPage,
        endCursor: hasNextPage ? 'cursor-2' : null,
      },
      edges: [
        {
          __typename: 'MealTemplateItemEdge',
          node: {
            __typename: 'MealTemplateItem',
            id: 'ti-1',
            dayOffset: 0,
            mealType: MealType.Dinner,
            servings: 2,
            notes: null,
            customMealName: null,
            recipe: {
              __typename: 'Recipe',
              id: 'recipe-1',
              name: 'Ragu',
              imageUrl: null,
              servings: 4,
              totalTimeMinutes: 90,
            },
          },
        },
        {
          __typename: 'MealTemplateItemEdge',
          node: {
            __typename: 'MealTemplateItem',
            id: 'ti-2',
            dayOffset: 2,
            mealType: MealType.Lunch,
            servings: null,
            notes: null,
            customMealName: 'Leftovers',
            recipe: null,
          },
        },
      ],
    },
  },
});

/** A cache holding the template the way opening it leaves it. */
const seeded = (data = template()): InMemoryCache => {
  const cache = makeCache();
  cache.writeQuery({
    query: GetMealTemplateDocument,
    variables: { id: TEMPLATE_ID, itemsFirst: MEALS_PAGE_SIZE },
    data,
  });
  return cache;
};

const PLAN_ID = 'plan-1';

/** A cache holding a week's plan the way `GetMealPlan` leaves its meals. */
const seededPlan = (hasNextPage: boolean = false): InMemoryCache => {
  const cache = makeCache();
  cache.writeFragment({
    id: cache.identify({ __typename: 'MealPlan', id: PLAN_ID }),
    fragment: UseDuplicateMealPlan_MealPlanFragmentDoc,
    fragmentName: 'useDuplicateMealPlan_mealPlan',
    data: {
      __typename: 'MealPlan',
      id: PLAN_ID,
      description: 'A week of food',
      planType: MealPlanType.Weekly,
      servings: 4,
      budgetAmount: null,
      homeId: 'home-1',
      startDate: '2026-01-05',
      endDate: '2026-01-11',
      mealPlanItemsConnection: {
        __typename: 'MealPlanItemConnection',
        totalCount: 2,
        pageInfo: { __typename: 'PageInfo', hasNextPage },
        edges: [
          {
            __typename: 'MealPlanItemEdge',
            node: {
              __typename: 'MealPlanItem',
              id: 'mpi-1',
              date: '2026-01-05',
              mealType: MealType.Dinner,
              servings: 2,
              notes: null,
              customMealName: null,
              recipe: { __typename: 'Recipe', id: 'recipe-1' },
            },
          },
          {
            __typename: 'MealPlanItemEdge',
            node: {
              __typename: 'MealPlanItem',
              id: 'mpi-2',
              date: '2026-01-07',
              mealType: MealType.Lunch,
              servings: null,
              notes: null,
              customMealName: 'Leftovers',
              recipe: null,
            },
          },
        ],
      },
    },
  });
  return cache;
};

/** The ids of a plan's meals as the detail screen reads them, or null. */
const mealsOnScreen = (cache: InMemoryCache, planId: string | null) =>
  cache
    .readFragment({
      id: cache.identify({ __typename: 'MealPlan', id: planId ?? '' }),
      fragment: MealPlanMain_MealPlanFragmentDoc,
      fragmentName: 'MealPlanMain_mealPlan',
    })
    ?.mealPlanItemsConnection.edges.map(edge => edge.node.id) ?? null;

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

// Queued: the plan create resolves with a null payload and keeps its local row.
const queuedPlanMock = () =>
  recordMock(CreateMealPlanDocument, { data: { createMealPlan: null } });

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
    expect(result.current.creatingFromTemplate).toBe(false);
  });

  describe('laying a template onto dates', () => {
    it('refuses when the template is not cached, without firing anything', async () => {
      const item = createItemMock();
      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [item.mock],
      });

      const response = await result.current.createPlanFromTemplate({
        templateId: TEMPLATE_ID,
        startDate: '2026-02-02',
      });

      expect(response).toBeNull();
      expect(item.fired).toHaveLength(0);
      expect(toastService.error).toHaveBeenCalled();
    });

    // A plan laid from a first page alone would silently drop the other meals.
    it('refuses a template whose later pages of meals are unread, without firing anything', async () => {
      const plan = queuedPlanMock();
      const item = createItemMock();
      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [plan.mock, item.mock],
        cache: seeded(template(true)),
      });

      const response = await result.current.createPlanFromTemplate({
        templateId: TEMPLATE_ID,
        startDate: '2026-02-02',
      });

      expect(response).toBeNull();
      expect(plan.fired).toHaveLength(0);
      expect(item.fired).toHaveLength(0);
      expect(toastService.error).toHaveBeenCalledTimes(1);
      expect(toastService.success).not.toHaveBeenCalled();
    });

    it('creates a meal per template item, offset from the chosen start', async () => {
      useStore.setState({ apiReachable: false });
      const item = createItemMock();
      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [queuedPlanMock().mock, item.mock],
        cache: seeded(),
      });

      const response = await result.current.createPlanFromTemplate({
        templateId: TEMPLATE_ID,
        startDate: '2026-02-02',
      });

      expect(response?.mealPlanId).toBeTruthy();
      const sent = item.fired as Array<{
        input: { date: string; mealPlanId: string };
      }>;
      expect(sent.map(f => f.input.date)).toEqual(['2026-02-02', '2026-02-04']);
      expect(sent.every(f => f.input.mealPlanId === response?.mealPlanId)).toBe(
        true,
      );
    });

    it('creates the plan over the template days, naming the template it came from', async () => {
      const plan = queuedPlanMock();
      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [plan.mock, createItemMock().mock],
        cache: seeded(),
      });

      const response = await result.current.createPlanFromTemplate({
        templateId: TEMPLATE_ID,
        // The last days of a month: the plan ends in the next one.
        startDate: '2026-01-30',
        servings: 6,
      });

      expect(plan.fired).toEqual([
        {
          input: {
            id: response?.mealPlanId,
            name: 'Weeknights',
            // Three days, counted inclusively.
            startDate: '2026-01-30',
            endDate: '2026-02-01',
            planType: MealPlanType.Weekly,
            // The server counts the template's use with the plan made from it.
            templateId: TEMPLATE_ID,
            description: 'Quick dinners',
            servings: 6,
            homeId: 'home-1',
          },
        },
      ]);
    });
  });

  describe('the new plan offline', () => {
    it('shows every laid-out meal from the cache while queued', async () => {
      useStore.setState({ apiReachable: false });
      const queuedItem = recordMock(CreateMealPlanItemDocument, {
        data: { createMealPlanItem: null },
      });
      const cache = seeded();
      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [queuedPlanMock().mock, queuedItem.mock],
        cache,
      });

      const response = await result.current.createPlanFromTemplate({
        templateId: TEMPLATE_ID,
        startDate: '2026-02-02',
      });

      const sentIds = (
        queuedItem.fired as Array<{ input: { id: string } }>
      ).map(fired => fired.input.id);
      expect(sentIds).toHaveLength(2);
      // The detail screen reads the new plan complete, an edge per meal.
      expect(mealsOnScreen(cache, response?.mealPlanId ?? null)).toEqual(
        sentIds,
      );
      expect(
        sentIds.map(id => cache.extract()[`MealPlanItem:${id}`]?.date),
      ).toEqual(['2026-02-02', '2026-02-04']);
    });
  });

  describe('cutting a template from a plan', () => {
    // Queued: the create resolves with a null payload and keeps its local row.
    const queuedTemplateMock = () =>
      recordMock(CreateMealTemplateDocument, {
        data: { createMealTemplate: null },
      });

    it('refuses when the plan is not cached, without firing anything', async () => {
      const create = queuedTemplateMock();
      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [create.mock],
      });

      expect(
        await result.current.createTemplateFromPlan({
          mealPlanId: PLAN_ID,
          name: 'Cut',
        }),
      ).toBeNull();
      expect(create.fired).toHaveLength(0);
      expect(toastService.error).toHaveBeenCalledTimes(1);
    });

    it('refuses a plan whose later pages of meals are unread, without firing anything', async () => {
      const create = queuedTemplateMock();
      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [create.mock],
        cache: seededPlan(true),
      });

      expect(
        await result.current.createTemplateFromPlan({
          mealPlanId: PLAN_ID,
          name: 'Cut',
        }),
      ).toBeNull();
      expect(create.fired).toHaveLength(0);
      expect(toastService.error).toHaveBeenCalledTimes(1);
      expect(toastService.success).not.toHaveBeenCalled();
    });

    it('sends one create with each meal at its day offset, and holds the template with its meals', async () => {
      useStore.setState({ apiReachable: false });
      const create = queuedTemplateMock();
      const cache = seededPlan();
      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [create.mock],
        cache,
      });

      const response = await result.current.createTemplateFromPlan({
        mealPlanId: PLAN_ID,
        name: 'Cut',
        category: TemplateCategory.Custom,
      });

      const templateId = response?.mealTemplateId ?? '';
      expect(create.fired).toEqual([
        {
          input: {
            id: templateId,
            name: 'Cut',
            // The 5th to the 11th, counted inclusively.
            durationDays: 7,
            items: [
              {
                id: expect.any(String),
                dayOffset: 0,
                mealType: MealType.Dinner,
                meal: { recipeId: 'recipe-1' },
                servings: 2,
              },
              {
                id: expect.any(String),
                dayOffset: 2,
                mealType: MealType.Lunch,
                meal: { customMealName: 'Leftovers' },
              },
            ],
            category: TemplateCategory.Custom,
            defaultServings: 4,
            homeId: 'home-1',
          },
        },
      ]);
      const sentItems = (
        create.fired[0] as { input: { items: Array<{ id: string }> } }
      ).input.items;
      // Written whole, with no page left to read: it can be copied or laid
      // onto dates straight away.
      expect(
        readTemplateSource(cache, templateId)?.items.map(item => [
          item.id,
          item.dayOffset,
        ]),
      ).toEqual([
        [sentItems[0]?.id, 0],
        [sentItems[1]?.id, 2],
      ]);
      expect(toastService.success).toHaveBeenCalledTimes(1);
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

    it('refuses a template whose later pages of meals are unread', async () => {
      const create = createTemplateMock();
      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [create.mock],
        cache: seeded(template(true)),
      });

      expect(
        await result.current.duplicateTemplate(TEMPLATE_ID, 'Copy'),
      ).toBeNull();
      expect(create.fired).toHaveLength(0);
      expect(toastService.error).toHaveBeenCalledTimes(1);
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

      // The copy is in the cache before any server round trip, with its meals.
      expect(
        cache.extract()[`MealTemplate:${response?.mealTemplateId}`],
      ).toMatchObject({ name: 'Weeknights (Copy)' });
      expect(
        readTemplateSource(cache, response?.mealTemplateId ?? '')?.items.map(
          copied => copied.dayOffset,
        ),
      ).toEqual([0, 2]);
    });

    it('takes the copy back and claims no success when the create is refused', async () => {
      const refused = recordMock(CreateMealTemplateDocument, {
        data: {
          createMealTemplate: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            message: 'raw server English',
          },
        },
      });
      const cache = seeded();
      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [refused.mock],
        cache,
      });

      const response = await result.current.duplicateTemplate(
        TEMPLATE_ID,
        'Weeknights (Copy)',
      );

      expect(response).toBeNull();
      expect(refused.fired).toHaveLength(1);
      expect(toastService.success).not.toHaveBeenCalled();
      const copies = Object.keys(cache.extract()).filter(
        key =>
          key.startsWith('MealTemplate:') &&
          key !== `MealTemplate:${TEMPLATE_ID}`,
      );
      expect(copies).toEqual([]);
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
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'raw server English',
          },
        },
      });

      const { result } = renderHookWithApollo(() => useMealTemplateActions(), {
        operationMocks: [del.mock],
      });

      expect(await result.current.deleteTemplate(TEMPLATE_ID)).toBe(false);
    });

    // The response's `mealTemplate { id }` re-creates the evicted template; a
    // list edge left pointing at it would read a card with no fields.
    it('leaves the list readable without the template once the response lands', async () => {
      const TEMPLATES = gql`
        query TestDeleteTemplatesList {
          mealTemplates {
            edges {
              node {
                id
                name
              }
            }
            totalCount
          }
        }
      `;
      const cache = makeCache();
      cache.writeQuery({
        query: TEMPLATES,
        data: {
          mealTemplates: {
            __typename: 'MealTemplateConnection',
            totalCount: 2,
            edges: [TEMPLATE_ID, 'template-2'].map(id => ({
              __typename: 'MealTemplateEdge',
              node: { __typename: 'MealTemplate', id, name: id },
            })),
          },
        },
      });
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
        cache,
      });

      expect(await result.current.deleteTemplate(TEMPLATE_ID)).toBe(true);

      const list = cache.readQuery<{
        mealTemplates: { edges: Array<{ node: { id: string } }> };
      }>({ query: TEMPLATES });
      expect(list?.mealTemplates.edges.map(({ node }) => node.id)).toEqual([
        'template-2',
      ]);
      expect(cache.extract()[`MealTemplate:${TEMPLATE_ID}`]).toBeUndefined();
    });
  });
});
