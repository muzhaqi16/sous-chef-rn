import { planFromTemplate } from '#features/mealPlan/utils/planFromTemplate';
import { templateFromPlan } from '#features/mealPlan/utils/templateFromPlan';
import { duplicateTemplate } from '#features/mealPlan/utils/duplicateTemplate';
import {
  MealPlanType,
  MealType,
  TemplateCategory,
} from '#/graphql/generated/schemaTypes';
import {
  leftoversLunch,
  planSource,
  recipeDinner,
} from '#/test-utils/fixtures/mealPlanFixtures';

/**
 * A plan's meals carry absolute days (`LocalDate` keys) and a template's carry
 * a day offset from its start. Converting between the two is the whole job, so
 * each case pins one end of that round trip.
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
      startDate: '2026-02-02',
      planType: MealPlanType.Weekly,
      mintId,
    });

    expect(items.map(i => i.date)).toEqual(['2026-02-02', '2026-02-04']);
  });

  it('ends the plan on its last covered day, counted inclusively', () => {
    const { plan } = planFromTemplate(source, {
      startDate: '2026-02-02',
      planType: MealPlanType.Weekly,
      mintId,
    });

    // Three days starting Monday ends Wednesday, not Thursday.
    expect(plan.endDate).toBe('2026-02-04');
  });

  it('starts and ends a one-day template on the same date', () => {
    const { plan } = planFromTemplate(
      { ...source, durationDays: 1 },
      {
        startDate: '2026-02-02',
        planType: MealPlanType.Weekly,
        mintId,
      },
    );

    expect(plan.startDate).toBe('2026-02-02');
    expect(plan.endDate).toBe('2026-02-02');
  });

  it('treats a template with no stated duration as one day', () => {
    const { plan } = planFromTemplate(
      { ...source, durationDays: null },
      { startDate: '2026-02-02', planType: MealPlanType.Weekly, mintId },
    );

    expect(plan.endDate).toBe('2026-02-02');
  });

  it('lays the days out across a month boundary', () => {
    const { plan, items } = planFromTemplate(
      { ...source, durationDays: 7 },
      { startDate: '2026-01-29', planType: MealPlanType.Weekly, mintId },
    );

    expect(plan.endDate).toBe('2026-02-04');
    expect(items.map(i => i.date)).toEqual(['2026-01-29', '2026-01-31']);
  });

  // 8 March 2026 loses an hour in the US; 29 March does in Europe.
  it.each([
    ['2026-03-07', ['2026-03-07', '2026-03-08', '2026-03-09']],
    ['2026-03-28', ['2026-03-28', '2026-03-29', '2026-03-30']],
  ])(
    'lays one day per offset from %s, over a 23-hour day',
    (startDate, days) => {
      const { plan, items } = planFromTemplate(
        {
          ...source,
          items: [0, 1, 2].map(dayOffset => ({
            ...templateItems[0]!,
            id: `ti-day-${dayOffset}`,
            dayOffset,
          })),
        },
        { startDate, planType: MealPlanType.Weekly, mintId },
      );

      expect(items.map(i => i.date)).toEqual(days);
      expect(plan.endDate).toBe(days[2]);
    },
  );

  it('names the template the plan was made from, for the server to count its use', () => {
    const { plan } = planFromTemplate(source, {
      startDate: '2026-02-02',
      planType: MealPlanType.Weekly,
      mintId,
    });

    expect(plan.templateId).toBe('template-1');
  });

  it('states the plan as its input: the template fields, the caller options, the dates', () => {
    const { plan } = planFromTemplate(source, {
      startDate: '2026-02-02',
      planType: MealPlanType.Monthly,
      budgetAmount: 80,
      dietaryProfileId: 'profile-1',
      servings: 6,
      mintId,
    });

    expect(plan).toEqual({
      id: 'minted-1',
      name: 'Weeknights',
      startDate: '2026-02-02',
      endDate: '2026-02-04',
      planType: MealPlanType.Monthly,
      templateId: 'template-1',
      description: 'Quick dinners',
      budgetAmount: 80,
      dietaryProfileId: 'profile-1',
      servings: 6,
      homeId: 'home-1',
    });
  });

  it('takes the template name unless one is given', () => {
    const opts = {
      startDate: '2026-02-02',
      planType: MealPlanType.Weekly,
      mintId,
    };

    expect(planFromTemplate(source, opts).plan.name).toBe('Weeknights');
    expect(
      planFromTemplate(source, { ...opts, name: 'My week' }).plan.name,
    ).toBe('My week');
  });

  it('takes the template name when the given one is blank, and trims a real one', () => {
    const opts = {
      startDate: '2026-02-02',
      planType: MealPlanType.Weekly,
      mintId,
    };

    expect(planFromTemplate(source, { ...opts, name: '' }).plan.name).toBe(
      'Weeknights',
    );
    expect(planFromTemplate(source, { ...opts, name: '   ' }).plan.name).toBe(
      'Weeknights',
    );
    expect(
      planFromTemplate(source, { ...opts, name: '  My week ' }).plan.name,
    ).toBe('My week');
  });

  it('parents every meal to the minted plan', () => {
    const { plan, items } = planFromTemplate(source, {
      startDate: '2026-02-02',
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
        startDate: '2026-02-02',
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
  const plan = planSource({
    mealPlanItems: [recipeDinner(), leftoversLunch({ date: '2026-01-08' })],
  });

  it('turns each meal date into an offset from the plan start', () => {
    const { template } = templateFromPlan(plan, { name: 'Cut', mintId });

    expect(template.items?.map(i => i.dayOffset)).toEqual([0, 3]);
  });

  it('counts the span inclusively', () => {
    const { template } = templateFromPlan(plan, { name: 'Cut', mintId });

    // The 5th to the 11th is seven days, not the six the endpoints differ by.
    expect(template.durationDays).toBe(7);
  });

  it('is one day long for a plan that starts and ends on the same day', () => {
    const { template } = templateFromPlan(
      {
        ...plan,
        startDate: '2026-01-05',
        endDate: '2026-01-05',
        mealPlanItems: [plan.mealPlanItems[0]!],
      },
      { name: 'Cut', mintId },
    );

    expect(template.durationDays).toBe(1);
    expect(template.items?.map(i => i.dayOffset)).toEqual([0]);
  });

  it('counts offsets and the span across a month boundary', () => {
    const { template } = templateFromPlan(
      {
        ...plan,
        startDate: '2026-01-29',
        endDate: '2026-02-04',
        mealPlanItems: [
          { ...plan.mealPlanItems[0]!, date: '2026-01-31' },
          { ...plan.mealPlanItems[1]!, date: '2026-02-04' },
        ],
      },
      { name: 'Cut', mintId },
    );

    expect(template.items?.map(i => i.dayOffset)).toEqual([2, 6]);
    expect(template.durationDays).toBe(7);
  });

  // 8 March 2026 loses an hour in the US; 29 March does in Europe.
  it.each([
    ['2026-03-07', '2026-03-09', '2026-03-13'],
    ['2026-03-28', '2026-03-30', '2026-04-03'],
  ])(
    'counts a 23-hour day as one day of the span and of an offset, from %s',
    (startDate, mealDate, endDate) => {
      const { template } = templateFromPlan(
        {
          ...plan,
          startDate,
          endDate,
          mealPlanItems: [{ ...plan.mealPlanItems[0]!, date: mealDate }],
        },
        { name: 'Cut', mintId },
      );

      expect(template.items?.map(i => i.dayOffset)).toEqual([2]);
      expect(template.durationDays).toBe(7);
    },
  );

  it('lays back onto the days it was cut from', () => {
    const { template } = templateFromPlan(plan, { name: 'Cut', mintId });

    const relaid = planFromTemplate(
      {
        id: template.id ?? '',
        name: template.name,
        durationDays: template.durationDays,
        items: (template.items ?? []).map(item => ({
          id: item.id ?? '',
          dayOffset: item.dayOffset,
          mealType: item.mealType,
          customMealName: item.meal.customMealName,
          recipe: item.meal.recipeId ? { id: item.meal.recipeId } : null,
        })),
      },
      { startDate: plan.startDate, planType: MealPlanType.Weekly, mintId },
    );

    expect(relaid.plan.endDate).toBe(plan.endDate);
    expect(relaid.items.map(i => i.date)).toEqual(
      plan.mealPlanItems.map(meal => meal.date),
    );
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
