import React from 'react';
import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  seedQuery,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { screenShows } from '#/test-utils/cacheWaits';
import { recipeRead } from '#/test-utils/fixtures/recipeFixtures';
import { useStore } from '#store';
import { t } from '#/i18n';
import { MealType, TemplateCategory } from '#/graphql/generated/schemaTypes';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import { GetDietaryProfileDocument } from '#operations/user/user.generated';
import { GetRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import {
  AddTemplateItemDocument,
  CreateMealTemplateDocument,
  GetMealTemplateForEditDocument,
  RemoveTemplateItemDocument,
  UpdateMealTemplateDocument,
  UpdateTemplateItemDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import { AddMealSheet } from '#features/mealPlan/components/AddMealSheet';
import { mealPlanTestIDs } from '#features/mealPlan/testIDs';
import { MEAL_TYPE_LABEL_KEYS } from '#features/mealPlan/utils/mealPlanEnumLabels';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import { MealTemplateBuilderScreen } from '../MealTemplateBuilderScreen';

jest.mock('#hooks/navigation/useAppNavigation');

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const ME = 'user-1';

let log = operationLog();

type Template = NonNullable<
  MockDataFor<typeof GetMealTemplateForEditDocument>['mealTemplate']
>;
type TemplateItem = NonNullable<
  NonNullable<
    NonNullable<NonNullable<Template['itemsConnection']>['edges']>[number]
  >['node']
>;

const LASAGNA_ITEM: TemplateItem = {
  __typename: 'MealTemplateItem',
  id: 'item-1',
  dayOffset: 1,
  mealType: MealType.Dinner,
  customMealName: null,
  servings: 4,
  notes: null,
  recipe: {
    __typename: 'Recipe',
    version: 1,
    id: 'recipe-1',
    name: 'Lasagna',
    imageUrl: null,
    servings: 4,
    totalTimeMinutes: 45,
  },
};

const templateRead = (items: TemplateItem[] = [LASAGNA_ITEM]): Template => ({
  __typename: 'MealTemplate',
  id: 'tpl-1',
  name: 'Week A',
  description: 'Easy week',
  category: TemplateCategory.Weekly,
  defaultServings: 3,
  tags: ['quick'],
  updatedAt: '2026-01-01T00:00:00Z',
  itemsConnection: {
    __typename: 'MealTemplateItemConnection',
    edges: items.map(node => ({ __typename: 'MealTemplateItemEdge', node })),
    pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
  },
});

interface Visit {
  /** The template being edited; none opens a new one. */
  template?: Template | null;
  readFails?: boolean;
  cooksFor?: number | null;
  profileHeld?: boolean;
  answers?: ReturnType<typeof recordMock>[];
}

function openBuilder({
  template = null,
  readFails = false,
  cooksFor = 4,
  profileHeld = false,
  answers = [],
}: Visit = {}) {
  const cache = makeCache();
  // A recipe the person can pick, held as its own page left it.
  seedQuery(cache, {
    query: GetRecipeDocument,
    variables: {
      id: 'recipe-2',
      ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
    },
    data: { recipe: recipeRead({ id: 'recipe-2', name: 'Pho' }) },
  });
  const editing = template !== null || readFails;
  const reads = !editing
    ? []
    : readFails
    ? [
        recordMock(GetMealTemplateForEditDocument, {
          error: new Error('Network request failed'),
          maxUsageCount: 1,
        }),
        recordMock(GetMealTemplateForEditDocument, {
          data: { mealTemplate: templateRead() },
        }),
      ]
    : [
        recordMock(GetMealTemplateForEditDocument, {
          data: { mealTemplate: template },
        }),
      ];
  const profileRead = recordMock(GetDietaryProfileDocument, {
    held: profileHeld,
    data: {
      me: {
        __typename: 'User',
        id: ME,
        dietaryProfile: {
          __typename: 'DietaryProfile',
          id: 'profile-1',
          userId: ME,
          cooksFor,
          restrictions: [],
        },
      },
    },
  });
  const view = renderWithApollo(
    <MealTemplateBuilderScreen
      route={{ params: editing ? { templateId: 'tpl-1' } : undefined }}
    />,
    {
      cache,
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        ...reads.map(read => read.mock),
        profileRead.mock,
      ],
    },
  );
  return { ...view, cache, profileRead };
}

const counter = (label: string) =>
  screen.getByLabelText(t('a11y.valueSuffix', { label }));

// Typed over whole, as a select-on-focus field is.
const setCounter = (label: string, value: string) => {
  fireEvent.changeText(counter(label), value);
};

const sent = (write: ReturnType<typeof recordMock>) => {
  const [first] = write.fired;
  if (!first) throw new Error('nothing was sent');
  return inputOf(first);
};

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useStore.setState({
    user: {
      id: ME,
      email: 'cook@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    isOnline: true,
    apiReachable: true,
  });
});

describe('a new template', () => {
  it('starts it and its meals at who the person cooks for', async () => {
    openBuilder({ cooksFor: 5 });
    await log.landed(GetDietaryProfileDocument);

    expect(screen.getByText(t('labels.newTemplate'))).toBeTruthy();
    expect(counter(t('labels.defaultServings')).props.value).toBe('5');
    expect(counter(t('labels.servings')).props.value).toBe('5');
  });

  it("keeps a meal's chosen servings over a late answer", async () => {
    const { profileRead } = openBuilder({ cooksFor: 5, profileHeld: true });
    setCounter(t('labels.servings'), '3');

    profileRead.release();
    await log.landed(GetDietaryProfileDocument);

    expect(counter(t('labels.servings')).props.value).toBe('3');
  });

  it('holds its meals as drafts: added, edited in place, and removed', async () => {
    openBuilder();
    const user = userEvent.setup();
    expect(screen.getByText(t('mealTemplateBuilder.noMeals'))).toBeTruthy();

    await user.type(
      screen.getByTestId(mealPlanTestIDs.templateItemNameInput),
      'Toast',
    );
    await user.press(
      screen.getByTestId(mealPlanTestIDs.templateSubmitItemButton),
    );
    await user.press(screen.getByText('Toast'));
    await user.clear(screen.getByTestId(mealPlanTestIDs.templateItemNameInput));
    await user.type(
      screen.getByTestId(mealPlanTestIDs.templateItemNameInput),
      'French toast',
    );
    await user.press(
      screen.getByTestId(mealPlanTestIDs.templateSubmitItemButton),
    );

    expect(screen.queryByText('Toast')).not.toBeOnTheScreen();
    expect(screen.getByText('French toast')).toBeTruthy();

    await user.press(
      screen.getByLabelText(t('a11y.removeNamed', { name: 'French toast' })),
    );
    expect(screen.getByText(t('mealTemplateBuilder.noMeals'))).toBeTruthy();
  });

  it('names a picked recipe and takes its meal type, keeping no typed name', async () => {
    const created = recordMock(CreateMealTemplateDocument, { held: true });
    openBuilder({ answers: [created] });
    const user = userEvent.setup();
    await user.type(
      screen.getByTestId(mealPlanTestIDs.templateItemNameInput),
      'Something',
    );

    act(() => {
      screen
        .UNSAFE_getByType(AddMealSheet)
        .props.onAddRecipe('recipe-2', MealType.Lunch);
    });
    expect(
      screen.getByTestId(mealPlanTestIDs.templateItemRecipe),
    ).toHaveTextContent('Pho');
    await user.press(
      screen.getByTestId(mealPlanTestIDs.templateSubmitItemButton),
    );
    await user.type(
      screen.getByTestId(mealPlanTestIDs.templateNameInput),
      'Week B',
    );
    await user.press(screen.getByLabelText(t('labels.save')));
    await log.requested(CreateMealTemplateDocument);

    expect(sent(created)).toMatchObject({
      items: [
        expect.objectContaining({
          mealType: MealType.Lunch,
          meal: { recipeId: 'recipe-2' },
        }),
      ],
    });
  });

  it('is made with its meals, its tags tidied, and then left', async () => {
    const created = recordMock(CreateMealTemplateDocument, {
      dataFor: (variables): MockDataFor<typeof CreateMealTemplateDocument> => ({
        createMealTemplate: {
          __typename: 'CreateMealTemplatePayload',
          mealTemplate: { id: String(inputOf(variables).id) },
        },
      }),
    });
    openBuilder({ answers: [created] });
    const user = userEvent.setup();
    await user.type(
      screen.getByTestId(mealPlanTestIDs.templateItemNameInput),
      'Toast',
    );
    setCounter(t('mealTemplateBuilder.dayNumber'), '3');
    await user.press(
      screen.getByTestId(mealPlanTestIDs.templateSubmitItemButton),
    );
    await user.type(
      screen.getByTestId(mealPlanTestIDs.templateNameInput),
      'Week B',
    );
    await user.type(
      screen.getByPlaceholderText(t('labels.commaSeparated')),
      ' quick , easy ,',
    );

    await user.press(screen.getByLabelText(t('labels.save')));
    await log.landed(CreateMealTemplateDocument);
    await act(async () => undefined);

    expect(sent(created)).toMatchObject({
      name: 'Week B',
      tags: ['quick', 'easy'],
      items: [
        expect.objectContaining({
          dayOffset: 2,
          meal: { customMealName: 'Toast' },
        }),
      ],
    });
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('an edited template', () => {
  it('opens filled, its meals named by their recipes', async () => {
    openBuilder({ template: templateRead() });
    await log.landed(GetMealTemplateForEditDocument);

    expect(screen.getByText(t('labels.editTemplate'))).toBeTruthy();
    expect(screen.getByDisplayValue('Week A')).toBeTruthy();
    expect(screen.getByDisplayValue('Easy week')).toBeTruthy();
    expect(screen.getByText('Lasagna')).toBeTruthy();
    expect(
      screen.getByText(
        t('mealTemplateBuilder.itemSummary', {
          day: 2,
          meal: t(MEAL_TYPE_LABEL_KEYS[MealType.Dinner]),
          servings: 4,
        }),
      ),
    ).toBeTruthy();
  });

  it('keeps what was typed when the template is written again', async () => {
    const { cache, client } = openBuilder({ template: templateRead() });
    await log.landed(GetMealTemplateForEditDocument);
    const user = userEvent.setup();
    await user.type(screen.getByDisplayValue('Week A'), ' plus');
    const read = {
      query: GetMealTemplateForEditDocument,
      variables: { id: 'tpl-1', itemsFirst: MEALS_PAGE_SIZE },
    };

    seedQuery(cache, {
      ...read,
      data: {
        mealTemplate: { ...templateRead(), description: 'Easy week, again' },
      },
    });
    // The screen's own watcher hears of the write first.
    await act(async () => {
      await screenShows(
        client,
        read,
        () => client.readQuery(read)?.mealTemplate?.description,
        description => description === 'Easy week, again',
      );
    });

    expect(screen.getByDisplayValue('Week A plus')).toBeTruthy();
  });

  it('saves an edited meal in place, keeping its recipe, and clears the form', async () => {
    const updated = recordMock(UpdateTemplateItemDocument, {
      data: {
        updateTemplateItem: {
          __typename: 'UpdateTemplateItemPayload',
          mealTemplateItem: { id: 'item-1' },
        },
      },
    });
    openBuilder({ template: templateRead(), answers: [updated] });
    await log.landed(GetMealTemplateForEditDocument);
    const user = userEvent.setup();

    await user.press(screen.getByText('Lasagna'));
    setCounter(t('labels.servings'), '6');
    await user.press(
      screen.getByTestId(mealPlanTestIDs.templateSubmitItemButton),
    );
    await log.landed(UpdateTemplateItemDocument);
    await act(async () => undefined);

    expect(sent(updated)).toMatchObject({ id: 'item-1', servings: 6 });
    expect(sent(updated)).not.toHaveProperty('meal');
    expect(screen.getByText(t('mealTemplateBuilder.addMeal'))).toBeTruthy();
  });

  it('adds a meal on the day typed, and removes a saved one', async () => {
    const added = recordMock(AddTemplateItemDocument, { held: true });
    const removed = recordMock(RemoveTemplateItemDocument, { held: true });
    openBuilder({ template: templateRead(), answers: [added, removed] });
    await log.landed(GetMealTemplateForEditDocument);
    const user = userEvent.setup();

    await user.type(
      screen.getByTestId(mealPlanTestIDs.templateItemNameInput),
      'Toast',
    );
    setCounter(t('mealTemplateBuilder.dayNumber'), '3');
    await user.press(
      screen.getByTestId(mealPlanTestIDs.templateSubmitItemButton),
    );
    await log.requested(AddTemplateItemDocument);
    expect(sent(added)).toMatchObject({ templateId: 'tpl-1', dayOffset: 2 });

    await user.press(
      screen.getByLabelText(t('a11y.removeNamed', { name: 'Lasagna' })),
    );
    await log.requested(RemoveTemplateItemDocument);
    expect(sent(removed)).toMatchObject({ id: 'item-1' });
  });

  it('is saved, then left', async () => {
    const updated = recordMock(UpdateMealTemplateDocument, {
      data: {
        updateMealTemplate: {
          __typename: 'UpdateMealTemplatePayload',
          mealTemplate: { id: 'tpl-1' },
        },
      },
    });
    openBuilder({ template: templateRead(), answers: [updated] });
    await log.landed(GetMealTemplateForEditDocument);

    await userEvent.setup().press(screen.getByLabelText(t('labels.save')));
    await log.landed(UpdateMealTemplateDocument);
    await act(async () => undefined);

    expect(sent(updated)).toMatchObject({ id: 'tpl-1', name: 'Week A' });
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('offers to read it again in place of a blank form', async () => {
    openBuilder({ readFails: true });
    await log.landed(GetMealTemplateForEditDocument);

    expect(screen.getByText(t('dataState.errorTitle'))).toBeTruthy();
    await userEvent.setup().press(screen.getByText(t('labels.tryAgain')));
    await log.landed(GetMealTemplateForEditDocument, 2);

    expect(screen.getByDisplayValue('Week A')).toBeTruthy();
  });
});
