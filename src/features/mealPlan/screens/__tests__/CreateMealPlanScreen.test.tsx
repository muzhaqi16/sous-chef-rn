import React from 'react';
import { act, screen, userEvent } from '@testing-library/react-native';
import { Calendar } from 'react-native-calendars';
import { addDays, addMonths } from 'date-fns';
import { makeCache } from '#/apollo/cache';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  seedQuery,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { homesWithRole } from '#/test-utils/fixtures/homeFixtures';
import { useStore } from '#store';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { toDateKey } from '#/utils/dateUtils';
import {
  ErrorCode,
  ErrorDisposition,
  MembershipRole,
} from '#/graphql/generated/schemaTypes';
import { GetHomesDocument } from '#operations/home/home.generated';
import { GetDietaryProfileDocument } from '#operations/user/user.generated';
import { CreateMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { TemplateBrowserSheet } from '#features/mealPlan/components/TemplateBrowserSheet';
import { TemplatePreviewSheet } from '#features/mealPlan/components/TemplatePreviewSheet';
import { mealPlanTestIDs } from '#features/mealPlan/testIDs';
import { CreateMealPlanScreen } from '../CreateMealPlanScreen';

jest.mock('#hooks/navigation/useAppNavigation');

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const ME = 'user-1';
const HOME = {
  id: 'h1',
  name: 'Home',
  pantries: [{ id: 'p1', name: 'Kitchen', isDefault: true }],
};

let log = operationLog();

type Profile = NonNullable<
  NonNullable<
    MockDataFor<typeof GetDietaryProfileDocument>['me']
  >['dietaryProfile']
>;

function openCreate({
  homes = [HOME],
  cooksFor = 4,
  profile = true,
  profileHeld = false,
  answers = [],
}: {
  homes?: (typeof HOME)[];
  cooksFor?: number | null;
  /** Whether the person has a dietary profile. */
  profile?: boolean;
  profileHeld?: boolean;
  answers?: ReturnType<typeof recordMock>[];
} = {}) {
  const cache = makeCache();
  seedQuery(cache, {
    query: GetHomesDocument,
    data: homesWithRole(homes, MembershipRole.Owner),
  });
  const dietaryProfile: Profile | null = profile
    ? {
        __typename: 'DietaryProfile',
        id: 'profile-1',
        userId: ME,
        cooksFor,
        restrictions: [],
      }
    : null;
  const profileRead = recordMock(GetDietaryProfileDocument, {
    held: profileHeld,
    data: { me: { __typename: 'User', id: ME, dietaryProfile } },
  });
  renderWithApollo(<CreateMealPlanScreen />, {
    cache,
    links: [log.link],
    operationMocks: [...answers.map(answer => answer.mock), profileRead.mock],
  });
  return { profileRead };
}

const created = () =>
  recordMock(CreateMealPlanDocument, {
    dataFor: (variables): MockDataFor<typeof CreateMealPlanDocument> => ({
      createMealPlan: {
        __typename: 'CreateMealPlanPayload',
        mealPlan: { id: String(inputOf(variables).id) },
      },
    }),
  });

/** A week from now: inside the picker's range on any day the test runs. */
const START = addDays(new Date(), 7);

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByTestId(mealPlanTestIDs.createNameInput),
    '  Week one ',
  );
  // The start date's field: the form's only expandable button.
  await user.press(screen.getByRole('button', { expanded: false, name: /./ }));
  act(() => {
    screen.UNSAFE_getByType(Calendar).props.onDayPress({
      dateString: toDateKey(START),
      day: START.getDate(),
      month: START.getMonth() + 1,
      year: START.getFullYear(),
      timestamp: START.getTime(),
    });
  });
}

const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.press(screen.getByLabelText(t('labels.save')));

/** The input of the plan the form sent. */
const sentPlan = (write: ReturnType<typeof recordMock>) => {
  const [first] = write.fired;
  if (!first) throw new Error('no plan was sent');
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
    selectedHomeId: 'h1',
    isOnline: true,
    apiReachable: true,
  });
});

describe('a new meal plan', () => {
  it('sends a week from the picked day, for its home and who the person cooks for, then leaves', async () => {
    const plan = created();
    openCreate({ answers: [plan] });
    await log.landed(GetDietaryProfileDocument);
    const user = userEvent.setup();
    await fill(user);

    await save(user);
    await log.landed(CreateMealPlanDocument);
    await act(async () => undefined);

    const sent = sentPlan(plan);
    expect(sent).toMatchObject({
      name: 'Week one',
      startDate: toDateKey(START),
      endDate: toDateKey(addDays(START, 6)),
      servings: 4,
      homeId: 'h1',
    });
    expect(sent.description).toBeUndefined();
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('runs a month to the day before the same day next month', async () => {
    const plan = created();
    openCreate({ answers: [plan] });
    const user = userEvent.setup();
    await fill(user);
    // The form's own, ahead of the template sheets'.
    const [monthly] = screen.getAllByText(t('mealPlan.monthly'));
    if (!monthly) throw new Error('no monthly plan type');
    await user.press(monthly);

    await save(user);
    await log.requested(CreateMealPlanDocument);

    expect(sentPlan(plan)).toMatchObject({
      endDate: toDateKey(addDays(addMonths(START, 1), -1)),
    });
  });

  it('sends a budget, and no budget that is not a number', async () => {
    const plan = created();
    openCreate({ answers: [plan] });
    const user = userEvent.setup();
    await fill(user);
    await user.type(
      screen.getByTestId(mealPlanTestIDs.createBudgetInput),
      'abc',
    );

    await save(user);
    await log.requested(CreateMealPlanDocument);

    expect(sentPlan(plan).budgetAmount).toBeUndefined();
  });

  it('tracks nutrition only on request, and only with a profile', async () => {
    const plan = created();
    openCreate({ answers: [plan] });
    await log.landed(GetDietaryProfileDocument);
    const user = userEvent.setup();
    await fill(user);
    await user.press(screen.getByText(t('labels.trackNutritionGoals')));

    await save(user);
    await log.requested(CreateMealPlanDocument);

    expect(sentPlan(plan)).toMatchObject({ dietaryProfileId: 'profile-1' });
  });

  it('offers no nutrition tracking without a profile', async () => {
    openCreate({ profile: false });
    await log.landed(GetDietaryProfileDocument);

    expect(
      screen.queryByText(t('labels.trackNutritionGoals')),
    ).not.toBeOnTheScreen();
  });

  it('offers sharing with a home only when there is one', async () => {
    openCreate({ homes: [] });

    expect(screen.queryByText(t('mealPlan.shareWith'))).not.toBeOnTheScreen();
  });

  it('offers sharing with the home there is', async () => {
    openCreate();

    expect(screen.getByText(t('mealPlan.shareWith'))).toBeTruthy();
  });
});

describe('its servings', () => {
  it('fill from who the person cooks for when that answers late', async () => {
    const { profileRead } = openCreate({ profileHeld: true, cooksFor: 5 });
    expect(screen.getByDisplayValue('2')).toBeTruthy();

    profileRead.release();
    await log.landed(GetDietaryProfileDocument);

    expect(screen.getByDisplayValue('5')).toBeTruthy();
  });

  it('keep the count the person chose over a late answer', async () => {
    const { profileRead } = openCreate({ profileHeld: true, cooksFor: 5 });
    const user = userEvent.setup();
    const field = screen.getByDisplayValue('2');
    await user.clear(field);
    await user.type(field, '3');

    profileRead.release();
    await log.landed(GetDietaryProfileDocument);

    expect(screen.getByDisplayValue('3')).toBeTruthy();
  });
});

describe('a refused plan', () => {
  const refusing = (
    payload: NonNullable<
      MockDataFor<typeof CreateMealPlanDocument>['createMealPlan']
    >,
  ) =>
    recordMock(CreateMealPlanDocument, { data: { createMealPlan: payload } });

  it('says why on the field it names', async () => {
    openCreate({
      answers: [
        refusing({
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          disposition: ErrorDisposition.Fail,
          message: 'Too long',
          field: 'input.name',
        }),
      ],
    });
    const user = userEvent.setup();
    await fill(user);

    await save(user);
    await log.landed(CreateMealPlanDocument);
    await act(async () => undefined);

    expect(screen.getByText(t('mealPlan.failedToCreate'))).toBeTruthy();
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(mockNav.goBack).not.toHaveBeenCalled();
  });

  it('says why in an alert when it names no field', async () => {
    openCreate({
      answers: [
        refusing({
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          disposition: ErrorDisposition.Fail,
          message: 'No',
        }),
      ],
    });
    const user = userEvent.setup();
    await fill(user);

    await save(user);
    await log.landed(CreateMealPlanDocument);
    await act(async () => undefined);

    expect(alertService.alert).toHaveBeenCalled();
    expect(mockNav.goBack).not.toHaveBeenCalled();
  });
});

describe('a template', () => {
  it('opens its preview once picked', () => {
    openCreate();

    act(() => {
      screen.UNSAFE_getByType(TemplateBrowserSheet).props.onSelectTemplate({
        __typename: 'MealTemplate',
        id: 'template-1',
        name: 'Weeknights',
        description: null,
        defaultServings: 4,
        items: [],
      });
    });

    expect(screen.UNSAFE_getByType(TemplatePreviewSheet).props.visible).toBe(
      true,
    );
  });
});
