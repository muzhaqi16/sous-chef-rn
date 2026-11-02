import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { PendingWrites } from '#/apollo/pendingWrites/pendingWrites';
import type { PendingWrite } from '#/apollo/pendingWrites/types';
import {
  completeSeed,
  seedFragment,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import {
  MealPlanType,
  MealType,
  TemplateCategory,
} from '#/graphql/generated/schemaTypes';
import {
  CreateMealPlanDocument,
  CreateMealPlanItemDocument,
  DeleteMealPlanDocument,
  DeleteMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  AddTemplateItemDocument,
  CreateMealTemplateDocument,
  DeleteMealTemplateDocument,
  GetMealTemplateForEditDocument,
  RemoveTemplateItemDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import {
  addTemplateItem,
  createPlan,
  createPlanItem,
  createTemplate,
  removePlan,
  removePlanItem,
  removeTemplate,
  removeTemplateItem,
  type AddTemplateItemInputs,
  type CreatePlanInputs,
  type CreatePlanItemInputs,
  type CreateTemplateInputs,
  type RemovePlanItemInputs,
  type RemoveTemplateItemInputs,
} from '../localWrites';

const NOW = '2026-10-30T10:00:00.000Z';
const PLAN_ID = 'plan-1';
const TEMPLATE_ID = 'tpl-1';
const EDIT_VARS = { id: TEMPLATE_ID, itemsFirst: MEALS_PAGE_SIZE };

const PLANS = gql`
  query LocalWritesPlans {
    mealPlans {
      edges {
        node {
          id
        }
      }
      totalCount
    }
  }
`;

const TEMPLATES = gql`
  query LocalWritesTemplates {
    mealTemplates {
      edges {
        node {
          id
        }
      }
      totalCount
    }
  }
`;

// Selected with its paging arguments, as every reader of a loaded plan does.
const PLAN_MEALS = gql`
  fragment LocalWritesPlanMeals on MealPlan {
    id
    mealPlanItemsConnection(first: $mealsFirst, after: $mealsAfter) {
      edges {
        node {
          id
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const ROW_DATES = gql`
  fragment LocalWritesPlanDates on MealPlan {
    createdAt
  }
`;

type Listed<TField extends string> = {
  [field in TField]: {
    edges: { node: { id: string } }[];
    totalCount: number;
  };
};

function setup() {
  const cache = makeCache();
  seedQuery(cache, {
    query: PLANS,
    data: {
      mealPlans: {
        __typename: 'MealPlanConnection',
        totalCount: 1,
        edges: [
          {
            __typename: 'MealPlanEdge',
            node: { __typename: 'MealPlan', id: PLAN_ID },
          },
        ],
      },
    },
  });
  seedQuery(cache, {
    query: TEMPLATES,
    data: {
      mealTemplates: {
        __typename: 'MealTemplateConnection',
        totalCount: 1,
        edges: [
          {
            __typename: 'MealTemplateEdge',
            node: { __typename: 'MealTemplate', id: TEMPLATE_ID },
          },
        ],
      },
    },
  });
  seedFragment(cache, {
    id: cache.identify({ __typename: 'MealPlan', id: PLAN_ID }),
    fragment: PLAN_MEALS,
    data: {
      __typename: 'MealPlan',
      id: PLAN_ID,
      mealPlanItemsConnection: {
        __typename: 'MealPlanItemConnection',
        edges: [
          {
            __typename: 'MealPlanItemEdge',
            node: { __typename: 'MealPlanItem', id: 'held-meal' },
          },
        ],
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
      },
    },
  });
  seedQuery(cache, {
    query: GetMealTemplateForEditDocument,
    variables: EDIT_VARS,
    data: {
      mealTemplate: {
        __typename: 'MealTemplate',
        id: TEMPLATE_ID,
        category: TemplateCategory.Custom,
        tags: [],
        itemsConnection: {
          edges: [
            {
              node: {
                __typename: 'MealTemplateItem',
                id: 'held-item',
                mealType: MealType.Dinner,
              },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  });
  const table = {
    CreateMealPlan: createPlan,
    DeleteMealPlan: removePlan,
    CreateMealPlanItem: createPlanItem,
    DeleteMealPlanItem: removePlanItem,
    CreateMealTemplate: createTemplate,
    DeleteMealTemplate: removeTemplate,
    AddTemplateItem: addTemplateItem,
    RemoveTemplateItem: removeTemplateItem,
  };
  return { cache, writes: new PendingWrites(cache, table) };
}

type Setup = ReturnType<typeof setup>;

const plans = ({ cache }: Setup, optimistic = true) => {
  const list = cache.readQuery<Listed<'mealPlans'>>({
    query: PLANS,
    optimistic,
  })?.mealPlans;
  return {
    ids: list?.edges.map(({ node }) => node.id),
    total: list?.totalCount,
  };
};

const templates = ({ cache }: Setup, optimistic = true) =>
  cache
    .readQuery<Listed<'mealTemplates'>>({ query: TEMPLATES, optimistic })
    ?.mealTemplates.edges.map(({ node }) => node.id);

const meals = ({ cache }: Setup, optimistic = true) =>
  cache
    .readFragment<{
      mealPlanItemsConnection: { edges: { node: { id: string } }[] };
    }>({
      id: cache.identify({ __typename: 'MealPlan', id: PLAN_ID }),
      fragment: PLAN_MEALS,
      optimistic,
    })
    ?.mealPlanItemsConnection.edges.map(({ node }) => node.id);

const templateItems = ({ cache }: Setup, optimistic = true) =>
  cache
    .readQuery({
      query: GetMealTemplateForEditDocument,
      variables: EDIT_VARS,
      optimistic,
    })
    ?.mealTemplate?.itemsConnection.edges.map(({ node }) => node.id);

/** The server answers: Apollo writes it to the root, then the write commits. */
function answered(
  { cache, writes }: Setup,
  { id, document, variables }: PendingWrite,
  data: Record<string, unknown>,
): void {
  const stated = completeSeed(document, variables, data);
  seedQuery(cache, {
    id: 'ROOT_MUTATION',
    query: document,
    variables,
    data: stated,
  });
  writes.confirm(id, stated);
  writes.rebuild();
}

const newPlan = ({ writes }: Setup, id: string) => {
  const plan = {
    id,
    name: 'Next week',
    planType: MealPlanType.Weekly,
    startDate: '2026-11-02',
    endDate: '2026-11-08',
  };
  const inputs: CreatePlanInputs = { plan, creatorId: 'user-1', now: NOW };
  return writes.begin(CreateMealPlanDocument, { input: plan }, inputs);
};

const newMeal = ({ writes }: Setup, id: string) => {
  const item = {
    id,
    mealPlanId: PLAN_ID,
    date: '2026-09-29',
    mealType: MealType.Dinner,
    meal: { customMealName: 'Soup' },
  };
  const inputs: CreatePlanItemInputs = { item };
  return writes.begin(CreateMealPlanItemDocument, { input: item }, inputs);
};

const removeMeal = ({ writes }: Setup, id: string) => {
  const inputs: RemovePlanItemInputs = { mealPlanId: PLAN_ID };
  return writes.begin(DeleteMealPlanItemDocument, { input: { id } }, inputs);
};

const newTemplate = ({ writes }: Setup, id: string) => {
  const template = { id, name: 'Weeknights' };
  const inputs: CreateTemplateInputs = {
    template,
    ownerId: 'user-1',
    now: NOW,
  };
  return writes.begin(CreateMealTemplateDocument, { input: template }, inputs);
};

const addItem = ({ writes }: Setup, id: string) => {
  const item = {
    id,
    templateId: TEMPLATE_ID,
    dayOffset: 2,
    mealType: MealType.Lunch,
    meal: { customMealName: 'Stew' },
  };
  const inputs: AddTemplateItemInputs = { item };
  return writes.begin(AddTemplateItemDocument, { input: item }, inputs);
};

const removeItem = ({ writes }: Setup, id: string) => {
  const inputs: RemoveTemplateItemInputs = { templateId: TEMPLATE_ID };
  return writes.begin(RemoveTemplateItemDocument, { input: { id } }, inputs);
};

describe('creating a plan', () => {
  it('shows it first and counts it once, however often it is rebuilt', () => {
    const screen = setup();

    newPlan(screen, 'minted');
    screen.writes.rebuild();
    screen.writes.rebuild();

    expect(plans(screen)).toEqual({ ids: ['minted', PLAN_ID], total: 2 });
    expect(plans(screen, false)).toEqual({ ids: [PLAN_ID], total: 1 });
  });

  it('dates the row when it was made, not when it is rebuilt', () => {
    const screen = setup();

    newPlan(screen, 'minted');
    screen.writes.rebuild();

    expect(
      screen.cache.readFragment({
        id: 'MealPlan:minted',
        fragment: ROW_DATES,
        optimistic: true,
      }),
    ).toMatchObject({ createdAt: NOW });
  });

  it('ends on the server data when refused', () => {
    const screen = setup();

    screen.writes.drop(newPlan(screen, 'minted').id);

    expect(plans(screen)).toEqual({ ids: [PLAN_ID], total: 1 });
  });

  it('lists it in the server data once answered', () => {
    const screen = setup();

    answered(screen, newPlan(screen, 'minted'), {
      createMealPlan: {
        __typename: 'CreateMealPlanPayload',
        mealPlan: { __typename: 'MealPlan', id: 'minted' },
      },
    });

    expect(plans(screen, false)).toEqual({
      ids: ['minted', PLAN_ID],
      total: 2,
    });
  });
});

describe.each([
  {
    name: 'plan',
    document: DeleteMealPlanDocument,
    id: PLAN_ID,
    read: (screen: Setup, optimistic?: boolean) =>
      plans(screen, optimistic).ids,
    answer: {
      deleteMealPlan: {
        __typename: 'DeleteMealPlanPayload',
        converged: false,
        mealPlan: { __typename: 'MealPlan', id: PLAN_ID },
      },
    },
  },
  {
    name: 'template',
    document: DeleteMealTemplateDocument,
    id: TEMPLATE_ID,
    read: templates,
    answer: {
      deleteMealTemplate: {
        __typename: 'DeleteMealTemplatePayload',
        converged: false,
        mealTemplate: { __typename: 'MealTemplate', id: TEMPLATE_ID },
      },
    },
  },
])('removing a $name', ({ document, id, read, answer }) => {
  it('hides it and leaves the server data as it was', () => {
    const screen = setup();

    screen.writes.begin(document, { input: { id } });
    screen.writes.rebuild();

    expect(read(screen)).toEqual([]);
    expect(read(screen, false)).toEqual([id]);
  });

  it('shows it again when refused', () => {
    const screen = setup();

    screen.writes.drop(screen.writes.begin(document, { input: { id } }).id);

    expect(read(screen)).toEqual([id]);
  });

  it('does not revive it through the { id } its answer names', () => {
    const screen = setup();

    answered(screen, screen.writes.begin(document, { input: { id } }), answer);

    expect(read(screen, false)).toEqual([]);
  });
});

describe('adding a meal', () => {
  it('follows the meals the plan holds', () => {
    const screen = setup();

    newMeal(screen, 'minted');
    screen.writes.rebuild();

    expect(meals(screen)).toEqual(['held-meal', 'minted']);
    expect(meals(screen, false)).toEqual(['held-meal']);
  });

  it('ends on the server data when refused', () => {
    const screen = setup();

    screen.writes.drop(newMeal(screen, 'minted').id);

    expect(meals(screen)).toEqual(['held-meal']);
    expect(screen.cache.extract(true)['MealPlanItem:minted']).toBeUndefined();
  });

  it('keeps a meal the server created under its minted id', () => {
    const screen = setup();

    answered(screen, newMeal(screen, 'minted'), {
      createMealPlanItem: {
        __typename: 'CreateMealPlanItemPayload',
        mealPlanItem: { __typename: 'MealPlanItem', id: 'minted' },
        mealPlan: { __typename: 'MealPlan', id: PLAN_ID },
      },
    });

    expect(meals(screen, false)).toEqual(['held-meal', 'minted']);
  });

  it('shows the meal the server kept in place of the minted one', () => {
    const screen = setup();

    answered(screen, newMeal(screen, 'minted'), {
      createMealPlanItem: {
        __typename: 'CreateMealPlanItemPayload',
        mealPlanItem: { __typename: 'MealPlanItem', id: 'server-meal' },
        mealPlan: { __typename: 'MealPlan', id: PLAN_ID },
      },
    });

    expect(meals(screen, false)).toEqual(['held-meal', 'server-meal']);
    expect(screen.cache.extract()['MealPlanItem:minted']).toBeUndefined();
  });
});

describe('removing a meal', () => {
  it('takes it off the plan and leaves the server data as it was', () => {
    const screen = setup();

    removeMeal(screen, 'held-meal');
    screen.writes.rebuild();

    expect(meals(screen)).toEqual([]);
    expect(meals(screen, false)).toEqual(['held-meal']);
  });

  it('puts it back when refused', () => {
    const screen = setup();

    screen.writes.drop(removeMeal(screen, 'held-meal').id);

    expect(meals(screen)).toEqual(['held-meal']);
  });

  it('does not revive it through the { id } its answer names', () => {
    const screen = setup();

    answered(screen, removeMeal(screen, 'held-meal'), {
      deleteMealPlanItem: {
        __typename: 'DeleteMealPlanItemPayload',
        mealPlanItem: { __typename: 'MealPlanItem', id: 'held-meal' },
        mealPlan: { __typename: 'MealPlan', id: PLAN_ID },
      },
    });

    expect(meals(screen, false)).toEqual([]);
    expect(screen.cache.extract()['MealPlanItem:held-meal']).toBeUndefined();
  });
});

describe('creating a template', () => {
  it('shows it first, and ends on the server data when refused', () => {
    const screen = setup();

    const write = newTemplate(screen, 'minted');
    screen.writes.rebuild();
    expect(templates(screen)).toEqual(['minted', TEMPLATE_ID]);

    screen.writes.drop(write.id);
    expect(templates(screen)).toEqual([TEMPLATE_ID]);
  });

  it('lists it in the server data once answered', () => {
    const screen = setup();

    answered(screen, newTemplate(screen, 'minted'), {
      createMealTemplate: {
        __typename: 'CreateMealTemplatePayload',
        mealTemplate: {
          __typename: 'MealTemplate',
          id: 'minted',
          category: TemplateCategory.Custom,
        },
      },
    });

    expect(templates(screen, false)).toEqual(['minted', TEMPLATE_ID]);
  });
});

describe('a template meal', () => {
  it('shows an added one, and ends on the server data when refused', () => {
    const screen = setup();

    const write = addItem(screen, 'minted');
    screen.writes.rebuild();
    expect(templateItems(screen)).toEqual(['held-item', 'minted']);

    screen.writes.drop(write.id);
    expect(templateItems(screen)).toEqual(['held-item']);
  });

  it('keeps an added one the answer does not state', () => {
    const screen = setup();

    answered(screen, addItem(screen, 'minted'), {
      addTemplateItem: {
        __typename: 'AddTemplateItemPayload',
        mealTemplate: { __typename: 'MealTemplate', id: TEMPLATE_ID },
      },
    });

    expect(templateItems(screen, false)).toEqual(['held-item', 'minted']);
    expect(screen.cache.extract()['MealTemplateItem:minted']).toMatchObject({
      dayOffset: 2,
      customMealName: 'Stew',
    });
  });

  it('hides a removed one, and puts it back when refused', () => {
    const screen = setup();

    const write = removeItem(screen, 'held-item');
    screen.writes.rebuild();
    expect(templateItems(screen)).toEqual([]);
    expect(templateItems(screen, false)).toEqual(['held-item']);

    screen.writes.drop(write.id);
    expect(templateItems(screen)).toEqual(['held-item']);
  });

  it('does not revive a removed one through the { id } its answer names', () => {
    const screen = setup();

    answered(screen, removeItem(screen, 'held-item'), {
      removeTemplateItem: {
        __typename: 'RemoveTemplateItemPayload',
        mealTemplateItem: { __typename: 'MealTemplateItem', id: 'held-item' },
        mealTemplate: { __typename: 'MealTemplate', id: TEMPLATE_ID },
      },
    });

    expect(templateItems(screen, false)).toEqual([]);
  });
});
