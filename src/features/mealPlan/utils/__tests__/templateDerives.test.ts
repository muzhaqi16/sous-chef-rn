import { planFromTemplate } from '#features/mealPlan/utils/planFromTemplate';
import { templateFromPlan } from '#features/mealPlan/utils/templateFromPlan';
import { duplicateTemplate } from '#features/mealPlan/utils/duplicateTemplate';
import {
  MealPlanType,
  MealType,
  TemplateCategory,
} from '#/graphql/generated/schemaTypes';

/**
 * A plan's meals carry absolute dates and a template's carry a day offset from
 * its start. Converting between the two is the whole job, so each case pins one
 * end of that round trip.
 */

let next = 0;
const mintId = () => `minted-${++next}`;
beforeEach(() => {
  next = 0;
});

const templateItems = [
  {
    id: 'ti-1',
    dayOffset: 0,
    mealType: MealType.Dinner,
    servings: 2,
    notes: 'crispy',
    customMealName: null,
    recipe: { id: 'recipe-1' },
  },
  {
    id: 'ti-2',
    dayOffset: 2,
    mealType: MealType.Lunch,
    servings: null,
    notes: null,
    customMealName: 'Leftovers',
    recipe: null,
  },
];

describe('laying a template onto dates', () => {
  const source = {
    id: 'template-1',
    name: 'Weeknights',
    description: 'Quick dinners',
    durationDays: 3,
    defaultServings: 2,
    homeId: 'home-1',
    items: templateItems,
  };

  it('dates every meal from the chosen start plus its offset', () => {
    const { items } = planFromTemplate(source, {
      startDate: '2026-02-02T00:00:00.000Z',
      planType: MealPlanType.Weekly,
      mintId,
    });

    expect(items.map(i => i.date)).toEqual([
      '2026-02-02T00:00:00.000Z',
      '2026-02-04T00:00:00.000Z',
    ]);
  });

  it('ends the plan on its last covered day, counted inclusively', () => {
    const { plan } = planFromTemplate(source, {
      startDate: '2026-02-02T00:00:00.000Z',
      planType: MealPlanType.Weekly,
      mintId,
    });

    // Three days starting Monday ends Wednesday, not Thursday.
    expect(plan.endDate).toBe('2026-02-04T00:00:00.000Z');
  });

  it('starts and ends a one-day template on the same date', () => {
    const { plan } = planFromTemplate(
      { ...source, durationDays: 1 },
      {
        startDate: '2026-02-02T00:00:00.000Z',
        planType: MealPlanType.Weekly,
        mintId,
      },
    );

    expect(plan.endDate).toBe(plan.startDate);
  });

  it('takes the template name unless one is given', () => {
    const opts = {
      startDate: '2026-02-02T00:00:00.000Z',
      planType: MealPlanType.Weekly,
      mintId,
    };

    expect(planFromTemplate(source, opts).plan.name).toBe('Weeknights');
    expect(
      planFromTemplate(source, { ...opts, name: 'My week' }).plan.name,
    ).toBe('My week');
  });

  it('parents every meal to the minted plan', () => {
    const { plan, items } = planFromTemplate(source, {
      startDate: '2026-02-02T00:00:00.000Z',
      planType: MealPlanType.Weekly,
      mintId,
    });

    expect(items.every(i => i.mealPlanId === plan.id)).toBe(true);
  });

  it('omits a meal naming neither a recipe nor itself', () => {
    const { items, skipped } = planFromTemplate(
      {
        ...source,
        items: [{ ...templateItems[0]!, recipe: null, customMealName: null }],
      },
      {
        startDate: '2026-02-02T00:00:00.000Z',
        planType: MealPlanType.Weekly,
        mintId,
      },
    );

    expect(items).toHaveLength(0);
    expect(skipped).toEqual([
      { sourceId: 'ti-1', reason: 'meal-has-no-reference' },
    ]);
  });
});

describe('cutting a template from a plan', () => {
  const plan = {
    id: 'plan-1',
    description: 'A week of food',
    servings: 4,
    homeId: 'home-1',
    startDate: '2026-01-05T00:00:00.000Z',
    endDate: '2026-01-11T00:00:00.000Z',
    mealPlanItems: [
      {
        id: 'mpi-1',
        date: '2026-01-05T00:00:00.000Z',
        mealType: MealType.Dinner,
        servings: 2,
        notes: null,
        customMealName: null,
        recipe: { id: 'recipe-1' },
      },
      {
        id: 'mpi-2',
        date: '2026-01-08T00:00:00.000Z',
        mealType: MealType.Lunch,
        servings: null,
        notes: null,
        customMealName: 'Leftovers',
        recipe: null,
      },
    ],
  };

  it('turns each meal date into an offset from the plan start', () => {
    const { template } = templateFromPlan(plan, { name: 'Cut', mintId });

    expect(template.items?.map(i => i.dayOffset)).toEqual([0, 3]);
  });

  it('counts the span inclusively', () => {
    const { template } = templateFromPlan(plan, { name: 'Cut', mintId });

    // The 5th to the 11th is seven days, not the six the endpoints differ by.
    expect(template.durationDays).toBe(7);
  });

  it('carries the plan servings over as the template default', () => {
    expect(
      templateFromPlan(plan, { name: 'Cut', mintId }).template.defaultServings,
    ).toBe(4);
  });

  it('takes the category and tags from the caller, not the plan', () => {
    const { template } = templateFromPlan(plan, {
      name: 'Cut',
      category: TemplateCategory.Custom,
      tags: ['fast'],
      mintId,
    });

    expect(template.category).toBe(TemplateCategory.Custom);
    expect(template.tags).toEqual(['fast']);
  });
});

describe('duplicating a template', () => {
  const source = {
    id: 'template-1',
    description: 'Quick dinners',
    category: TemplateCategory.Custom,
    durationDays: 3,
    defaultServings: 2,
    tags: ['quick'],
    homeId: 'home-1',
    items: templateItems,
  };

  it('copies every item at its own offset under a new name', () => {
    const { template } = duplicateTemplate(source, {
      newName: 'Weeknights (Copy)',
      mintId,
    });

    expect(template.name).toBe('Weeknights (Copy)');
    expect(template.items?.map(i => i.dayOffset)).toEqual([0, 2]);
    expect(template.durationDays).toBe(3);
  });

  it('mints a fresh id for the copy and each of its items', () => {
    const { template } = duplicateTemplate(source, {
      newName: 'Copy',
      mintId,
    });

    // Items are minted first, the template last.
    expect(template.items?.map(i => i.id)).toEqual(['minted-1', 'minted-2']);
    expect(template.id).toBe('minted-3');
  });

  it('omits a meal naming neither a recipe nor itself', () => {
    const { template, skipped } = duplicateTemplate(
      {
        ...source,
        items: [{ ...templateItems[1]!, customMealName: null }],
      },
      { newName: 'Copy', mintId },
    );

    expect(template.items).toHaveLength(0);
    expect(skipped).toEqual([
      { sourceId: 'ti-2', reason: 'meal-has-no-reference' },
    ]);
  });
});
