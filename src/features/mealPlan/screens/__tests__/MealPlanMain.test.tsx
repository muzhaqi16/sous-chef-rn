import React, { useEffect } from 'react';
import { act, screen, userEvent } from '@testing-library/react-native';
import { addDays } from 'date-fns';
import { makeCache } from '#/apollo/cache';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { useStore } from '#store';
import { t } from '#/i18n';
import { toastService } from '#/services/toastService';
import { toDateKey } from '#/utils/dateUtils';
import {
  MealPlanType,
  MealType,
  MembershipRole,
} from '#/graphql/generated/schemaTypes';
import {
  CreateMealPlanItemDocument,
  DeleteMealPlanDocument,
  GetMealPlansDocument,
  UpdateMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import { CreateMealTemplateDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import { MealPlanSettingsSheet } from '#features/mealPlan/components/MealPlanSettingsSheet';
import { SaveAsTemplateSheet } from '#features/mealPlan/components/SaveAsTemplateSheet';
import { DayMealList } from '#features/mealPlan/components/DayMealList';
import {
  CurrentMealPlanDocument,
  GetMealPlanDocument,
} from '#features/mealPlan/screens/useMealPlan.generated';
import {
  TabBarActionsProvider,
  useTabBarSetters,
  useTabBarState,
  type TabBarAddAction,
} from '#/context/TabBarActionsContext';
import { AddMealSheet } from '#features/mealPlan/components/AddMealSheet';
import { MarkCookedModal } from '#features/recipes/ui/MarkCookedModal';
import { mealPlanTestIDs } from '#features/mealPlan/testIDs';
import { GetMealTemplatesDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import { MealPlanMain } from '../MealPlanMain';

jest.mock('#hooks/navigation/useAppNavigation');
// Navigation is the boundary: no navigator, so the tab counts as focused.
jest.mock('@react-navigation/native', () => {
  const { useEffect: useMountEffect } = jest.requireActual('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (effect: () => undefined | (() => void)) =>
      useMountEffect(effect, [effect]),
    useIsFocused: () => true,
  };
});

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const ME = 'user-1';
const TODAY = new Date();

/** What the shell's tab bar reads from the screen. */
const shell: { addMenu?: readonly TabBarAddAction[] } = {};
function TabBar() {
  const { setActiveTab } = useTabBarSetters();
  const { addMenu } = useTabBarState();
  useEffect(() => {
    setActiveTab('MealPlan');
  }, [setActiveTab]);
  useEffect(() => {
    shell.addMenu = addMenu;
  });
  return null;
}
const mealAction = () => shell.addMenu?.find(action => action.key === 'meal');

let log = operationLog();

type ListedEdge = NonNullable<
  NonNullable<
    NonNullable<MockDataFor<typeof GetMealPlansDocument>['mealPlans']>['edges']
  >[number]
>;
type ListedPlan = NonNullable<ListedEdge['node']>;
type HeldPlan = NonNullable<
  MockDataFor<typeof GetMealPlanDocument>['mealPlan']
>;
type HeldMeal = NonNullable<
  NonNullable<
    NonNullable<
      NonNullable<HeldPlan['mealPlanItemsConnection']>['edges']
    >[number]
  >['node']
>;

const WEEK = {
  startDate: toDateKey(addDays(TODAY, -2)),
  endDate: toDateKey(addDays(TODAY, 4)),
};

/** Who holds the plan: the person's own, or a household's they only view. */
type Holder = 'own' | 'viewer';
type HolderFields = Pick<ListedPlan, 'user' | 'homeId' | 'home'> &
  Pick<HeldPlan, 'user' | 'homeId' | 'home'>;
const holderOf = (holder: Holder): HolderFields =>
  holder === 'own'
    ? { user: { __typename: 'User', id: ME }, homeId: null, home: null }
    : {
        user: { __typename: 'User', id: 'user-2' },
        homeId: 'h1',
        home: {
          __typename: 'Home',
          version: 1,
          id: 'h1',
          name: 'Home',
          myMembership: {
            version: 1,
            id: 'member-1',
            role: MembershipRole.Guest,
          },
        },
      };

const listed = (holder: Holder): ListedPlan => ({
  __typename: 'MealPlan',
  id: 'plan-1',
  name: 'This week',
  description: null,
  planType: MealPlanType.Weekly,
  ...WEEK,
  ...holderOf(holder),
});

const LASAGNA: HeldMeal = {
  __typename: 'MealPlanItem',
  id: 'mpi-1',
  version: 1,
  date: toDateKey(TODAY),
  mealType: MealType.Dinner,
  isCompleted: false,
  completedAt: null,
  servings: 3,
  customMealName: null,
  notes: null,
  recipe: {
    __typename: 'Recipe',
    version: 1,
    id: 'recipe-1',
    name: 'Lasagna',
    servings: 4,
    imageUrl: null,
    totalTimeMinutes: 45,
  },
};

const held = (
  holder: Holder,
  meals: HeldMeal[],
  hasNextPage = false,
): HeldPlan => ({
  __typename: 'MealPlan',
  id: 'plan-1',
  version: 1,
  name: 'This week',
  ...WEEK,
  ...holderOf(holder),
  mealPlanItemsConnection: {
    __typename: 'MealPlanItemConnection',
    edges: meals.map(node => ({ __typename: 'MealPlanItemEdge', node })),
    pageInfo: {
      __typename: 'PageInfo',
      hasNextPage,
      endCursor: hasNextPage ? 'c-1' : null,
    },
  },
});

interface Visit {
  /** The plans the list holds; none means no plan yet. */
  plans?: ListedPlan[];
  /** The list cannot be read. */
  listFails?: boolean;
  /** The plan's own read. */
  plan?: HeldPlan | null;
  planFails?: boolean;
  planHeld?: boolean;
  answers?: ReturnType<typeof recordMock>[];
}

async function openPlans({
  plans = [listed('own')],
  listFails = false,
  plan = held('own', [LASAGNA]),
  planFails = false,
  planHeld = false,
  answers = [],
}: Visit = {}) {
  const list = listFails
    ? recordMock(GetMealPlansDocument, {
        error: new Error('Network request failed'),
        maxUsageCount: 1,
      })
    : recordMock(GetMealPlansDocument, {
        data: {
          mealPlans: {
            __typename: 'MealPlanConnection',
            edges: plans.map(
              (node): ListedEdge => ({
                __typename: 'MealPlanEdge',
                cursor: 'c',
                node,
              }),
            ),
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: false,
              endCursor: null,
            },
            totalCount: plans.length,
          },
        },
      });
  const planRead = planFails
    ? recordMock(GetMealPlanDocument, {
        error: new Error('Network request failed'),
      })
    : recordMock(GetMealPlanDocument, {
        held: planHeld,
        data: { mealPlan: plan },
      });
  const current = recordMock(CurrentMealPlanDocument, {
    held: planHeld,
    data: { currentMealPlan: planFails ? null : plan },
  });
  renderWithApollo(
    <TabBarActionsProvider>
      <TabBar />
      <MealPlanMain />
    </TabBarActionsProvider>,
    {
      cache: makeCache(),
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        list.mock,
        ...(listFails
          ? [
              recordMock(GetMealPlansDocument, {
                data: { mealPlans: { edges: [], totalCount: 0 } },
              }).mock,
            ]
          : []),
        planRead.mock,
        current.mock,
        recordMock(GetMealTemplatesDocument, {
          data: {
            mealTemplates: {
              __typename: 'MealTemplateConnection',
              edges: [],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        }).mock,
      ],
    },
  );
  // The tab's list and the plan selector's each read the plans.
  await log.landed(GetMealPlansDocument, 2);
  // A listed plan is read on its own before its days show.
  if (plans.length > 0 && !planHeld && !listFails) {
    await log.landed(GetMealPlanDocument);
  }
  await act(async () => undefined);
  return { planRead, current };
}

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  shell.addMenu = undefined;
  useStore.setState({
    user: {
      id: ME,
      email: 'cook@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    selectedHomeId: 'h1',
    selectedMealPlanId: null,
    isOnline: true,
    apiReachable: true,
  });
  mockNav.navigation.getState.mockReturnValue({
    type: 'tab',
    index: 0,
    routes: [{ name: 'MealPlan' }],
  });
});

describe('the meal plan tab', () => {
  it("shows the day's meals, and opens a recipe meal", async () => {
    await openPlans();

    await userEvent.setup().press(screen.getByText('Lasagna'));

    expect(mockNav.toRecipeDetail).toHaveBeenCalledWith({
      recipeId: 'recipe-1',
    });
  });

  it('points at starting a plan when there is none', async () => {
    await openPlans({ plans: [], plan: null });

    expect(screen.getByText(t('mealPlanEmpty.title'))).toBeTruthy();
    expect(mealAction()?.disabledReason).toBe(t('mealPlan.addNeedsPlan'));
  });

  it('offers a retry that reads the list again when it could not be read', async () => {
    await openPlans({ listFails: true, plan: null });

    expect(mealAction()?.disabledReason).toBe(t('mealPlan.needsThePlan'));
    await userEvent.setup().press(screen.getByText(t('labels.tryAgain')));

    // Beyond the tab's and the selector's first reads.
    await log.landed(GetMealPlansDocument, 3);
  });

  it('says a plan it cannot read is unavailable, not empty days', async () => {
    await openPlans({ planFails: true });
    await act(async () => undefined);

    expect(screen.getByText(t('dataState.errorTitle'))).toBeTruthy();
  });

  it('says a plan read in part is partial, and reads the rest on a tap', async () => {
    const laterPage = (options: { error?: Error; held?: boolean }) =>
      recordMock(GetMealPlanDocument, {
        match: variables => variables.mealsAfter === 'c-1',
        maxUsageCount: 1,
        ...options,
      });
    await openPlans({
      plan: held('own', [LASAGNA], true),
      answers: [
        laterPage({ error: new Error('Network request failed') }),
        laterPage({ held: true }),
      ],
    });
    await log.landed(GetMealPlanDocument, 2);
    await act(async () => undefined);

    await userEvent
      .setup()
      .press(screen.getByTestId(mealPlanTestIDs.mealsIncomplete));

    await log.requested(GetMealPlanDocument, 3);
  });

  it('opens a month from the calendar toggle', async () => {
    await openPlans();

    await userEvent
      .setup()
      .press(screen.getByLabelText(t('calendarToggle.expandToMonth')));

    expect(
      screen.getByLabelText(t('calendarToggle.collapseToWeek')),
    ).toBeTruthy();
  });
});

describe('its + action', () => {
  it('adds to a plan the person can edit, opening the add sheet', async () => {
    await openPlans();

    act(() => {
      mealAction()?.onPress();
    });

    expect(mealAction()?.disabledReason).toBeUndefined();
    expect(screen.UNSAFE_getByType(AddMealSheet).props.visible).toBe(true);
  });

  it('tells a viewer they cannot add', async () => {
    await openPlans({
      plans: [listed('viewer')],
      plan: held('viewer', [LASAGNA]),
    });

    expect(mealAction()?.disabledReason).toBe(t('mealPlan.noAddPermission'));
  });

  it('waits while the plan it would add to is loading', async () => {
    await openPlans({ planHeld: true });

    expect(mealAction()?.pending).toBe(true);
  });
});

describe('a meal', () => {
  it('is added on the day on screen, and the sheet closes', async () => {
    const created = recordMock(CreateMealPlanItemDocument, {
      dataFor: (variables): MockDataFor<typeof CreateMealPlanItemDocument> => ({
        createMealPlanItem: {
          __typename: 'CreateMealPlanItemPayload',
          mealPlanItem: {
            id: String(inputOf(variables).id),
            date: String(inputOf(variables).date),
          },
          mealPlan: { id: 'plan-1', ...WEEK },
        },
      }),
    });
    await openPlans({ answers: [created] });
    act(() => {
      mealAction()?.onPress();
    });

    await act(async () => {
      await screen
        .UNSAFE_getByType(AddMealSheet)
        .props.onAddRecipe('recipe-1', MealType.Lunch);
    });

    expect(inputOf(created.fired[0] ?? {})).toMatchObject({
      mealPlanId: 'plan-1',
      meal: { recipeId: 'recipe-1' },
      mealType: MealType.Lunch,
      date: toDateKey(TODAY),
    });
    expect(screen.UNSAFE_getByType(AddMealSheet).props.visible).toBe(false);
  });

  it('keeps a custom meal its name', async () => {
    const created = recordMock(CreateMealPlanItemDocument, { held: true });
    await openPlans({ answers: [created] });

    act(() => {
      void screen
        .UNSAFE_getByType(AddMealSheet)
        .props.onAddCustomMeal('Leftovers', MealType.Lunch);
    });
    await log.requested(CreateMealPlanItemDocument);

    expect(inputOf(created.fired[0] ?? {})).toMatchObject({
      meal: { customMealName: 'Leftovers' },
    });
  });

  it("that has a recipe asks how it was cooked, from the meal's servings", async () => {
    await openPlans();

    await userEvent
      .setup()
      .press(screen.getByTestId(mealPlanTestIDs.itemCompleteToggle('mpi-1')));

    const cook = screen.UNSAFE_getByType(MarkCookedModal);
    expect(cook.props.visible).toBe(true);
    expect(cook.props.defaultServings).toBe(3);
  });

  it('is marked cooked as the cook sheet says, deducting from the pantry', async () => {
    const updated = recordMock(UpdateMealPlanItemDocument, { held: true });
    await openPlans({ answers: [updated] });
    await userEvent
      .setup()
      .press(screen.getByTestId(mealPlanTestIDs.itemCompleteToggle('mpi-1')));

    act(() => {
      screen.UNSAFE_getByType(MarkCookedModal).props.onConfirm({
        servings: 3,
        deductFromPantry: true,
      });
    });
    await log.requested(UpdateMealPlanItemDocument);

    expect(inputOf(updated.fired[0] ?? {})).toMatchObject({
      id: 'mpi-1',
      isCompleted: true,
      deductFromPantry: true,
      servings: 3,
    });
  });
});

describe('a plan', () => {
  it('is read again with the list on a pull', async () => {
    await openPlans();

    act(() => {
      screen.UNSAFE_getByType(DayMealList).props.onRefresh();
    });

    await log.requested(GetMealPlansDocument, 3);
  });

  it('closes the template sheet once saved as a template', async () => {
    const created = recordMock(CreateMealTemplateDocument, {
      dataFor: (variables): MockDataFor<typeof CreateMealTemplateDocument> => ({
        createMealTemplate: {
          __typename: 'CreateMealTemplatePayload',
          mealTemplate: { id: String(inputOf(variables).id) },
        },
      }),
    });
    await openPlans({ answers: [created] });
    act(() => {
      screen.UNSAFE_getByType(MealPlanSettingsSheet).props.onSaveAsTemplate();
    });
    expect(screen.UNSAFE_getByType(SaveAsTemplateSheet).props.visible).toBe(
      true,
    );

    await act(async () => {
      await screen.UNSAFE_getByType(SaveAsTemplateSheet).props.onSave({
        mealPlanId: 'plan-1',
        name: 'Our week',
      });
    });

    expect(screen.UNSAFE_getByType(SaveAsTemplateSheet).props.visible).toBe(
      false,
    );
  });

  it('says so once deleted, and leaves it unselected', async () => {
    const deleted = recordMock(DeleteMealPlanDocument, {
      data: {
        deleteMealPlan: {
          __typename: 'DeleteMealPlanPayload',
          converged: false,
          mealPlan: { id: 'plan-1' },
        },
      },
    });
    await openPlans({ answers: [deleted] });
    act(() => {
      useStore.setState({ selectedMealPlanId: 'plan-1' });
    });

    await act(async () => {
      await screen
        .UNSAFE_getByType(MealPlanSettingsSheet)
        .props.onDelete('plan-1');
    });

    expect(toastService.success).toHaveBeenCalledWith(
      t('mealPlanMain.mealPlanDeleted'),
    );
    expect(useStore.getState().selectedMealPlanId).toBeNull();
  });
});
