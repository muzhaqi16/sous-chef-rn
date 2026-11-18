import React from 'react';
import { act, screen, userEvent } from '@testing-library/react-native';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { useStore } from '#store';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import {
  Diet,
  ReligiousDiet,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import {
  AddDietaryRestrictionDocument,
  GetDietaryProfileDocument,
  RemoveDietaryRestrictionDocument,
  UpdateDietaryProfileDocument,
} from '#operations/user/user.generated';
import { DietarySharingHomesDocument } from '#features/profile/hooks/useDietarySharing.generated';
import { DietaryRestrictionSelector } from '#features/profile/components/DietaryRestrictionSelector';
import { ReligiousDietPicker } from '#features/profile/ui/ReligiousDietPicker';
import { CookingPreferencesSheet } from '#features/profile/components/CookingPreferencesSheet/CookingPreferencesSheet';
import { MacroTargetsSheet } from '#features/profile/components/MacroTargetsSheet/MacroTargetsSheet';
import { DietaryProfileScreen } from '../DietaryProfileScreen';

jest.mock('#hooks/navigation/useAppNavigation');

const ME = 'user-1';

let log = operationLog();

type Profile = NonNullable<
  NonNullable<
    MockDataFor<typeof GetDietaryProfileDocument>['me']
  >['dietaryProfile']
>;
type Restriction = NonNullable<NonNullable<Profile['restrictions']>[number]>;
type SharingEdge = NonNullable<
  NonNullable<
    NonNullable<
      MockDataFor<typeof DietarySharingHomesDocument>['homes']
    >['edges']
  >[number]
>;

const VEGETARIAN: Restriction = {
  __typename: 'DietaryRestriction',
  id: 'r-veg',
  diet: Diet.Vegetarian,
  intolerance: null,
  healthGoal: null,
  religiousDiet: null,
  item: null,
  severity: RestrictionSeverity.Preference,
  notes: null,
};

const profileOf = (overrides: Partial<Profile> = {}): Profile => ({
  __typename: 'DietaryProfile',
  id: 'profile-1',
  userId: ME,
  calorieTarget: null,
  proteinTarget: null,
  carbsTarget: null,
  fatTarget: null,
  cooksFor: 2,
  religiousDiet: null,
  maxCookTimeMinutes: null,
  restrictions: [VEGETARIAN],
  ...overrides,
});

interface Visit {
  profile?: Profile;
  profileHeld?: boolean;
  profileFails?: boolean;
  homes?: string[];
  answers?: ReturnType<typeof recordMock>[];
}

async function openDietary({
  profile = profileOf(),
  profileHeld = false,
  profileFails = false,
  homes = [],
  answers = [],
}: Visit = {}) {
  const read = profileFails
    ? [
        recordMock(GetDietaryProfileDocument, {
          error: new Error('Network request failed'),
          maxUsageCount: 1,
        }),
        recordMock(GetDietaryProfileDocument, {
          data: { me: { __typename: 'User', id: ME, dietaryProfile: profile } },
        }),
      ]
    : [
        recordMock(GetDietaryProfileDocument, {
          held: profileHeld,
          data: { me: { __typename: 'User', id: ME, dietaryProfile: profile } },
        }),
      ];
  renderWithApollo(<DietaryProfileScreen />, {
    links: [log.link],
    operationMocks: [
      ...answers.map(answer => answer.mock),
      ...read.map(each => each.mock),
      recordMock(DietarySharingHomesDocument, {
        data: {
          homes: {
            __typename: 'HomeConnection',
            edges: homes.map(
              (name): SharingEdge => ({
                __typename: 'HomeEdge',
                cursor: name,
                node: {
                  __typename: 'Home',
                  version: 1,
                  id: `home-${name}`,
                  name,
                  myMembership: {
                    version: 1,
                    id: `member-${name}`,
                    sharesDietaryNeeds: false,
                  },
                },
              }),
            ),
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: false,
              endCursor: null,
            },
          },
        },
      }).mock,
    ],
  });
  if (!profileHeld) await log.landed(GetDietaryProfileDocument);
  await log.landed(DietarySharingHomesDocument);
}

/** Presses a button of the last alert raised. */
async function answerAlert(text: string) {
  const [, , buttons] = jest.mocked(alertService.alert).mock.lastCall ?? [];
  const onPress = buttons?.find(button => button.text === text)?.onPress;
  if (!onPress) throw new Error(`no "${text}" in the last alert`);
  await act(async () => {
    onPress();
  });
}

const updated = () =>
  recordMock(UpdateDietaryProfileDocument, {
    data: {
      updateDietaryProfile: {
        __typename: 'UpdateDietaryProfilePayload',
        dietaryProfile: profileOf(),
      },
    },
  });

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

describe('the dietary profile', () => {
  it('says it is loading while it has nothing to show', async () => {
    await openDietary({ profileHeld: true });

    expect(screen.getByText(t('dietary.loadingProfile'))).toBeTruthy();
  });

  it('offers to read it again when it could not be read', async () => {
    await openDietary({ profileFails: true });

    await userEvent.setup().press(screen.getByText(t('labels.tryAgain')));
    await log.landed(GetDietaryProfileDocument, 2);

    expect(screen.getByText(t('dietary.restrictions'))).toBeTruthy();
  });

  it('shows the cook time and targets set, and says when none are', async () => {
    await openDietary({
      profile: profileOf({ maxCookTimeMinutes: 30, calorieTarget: 2000 }),
    });

    // The editors repeat the labels, so the values set are what tell.
    expect(screen.getByText(/2000/)).toBeTruthy();
    expect(
      screen.queryByText(t('dietary.cookTimeEmpty')),
    ).not.toBeOnTheScreen();
    expect(
      screen.queryByText(t('dietary.macroTargetsEmpty')),
    ).not.toBeOnTheScreen();
  });

  it('says when no cook time or target is set', async () => {
    await openDietary();

    expect(screen.getByText(t('dietary.cookTimeEmpty'))).toBeTruthy();
    expect(screen.getByText(t('dietary.macroTargetsEmpty'))).toBeTruthy();
  });

  it('offers a sharing switch for each home, and none without one', async () => {
    await openDietary({ homes: ['Home', 'Cabin'] });

    expect(screen.getByText(t('dietary.sharedWith'))).toBeTruthy();
    expect(screen.getByText('Cabin')).toBeTruthy();
  });

  it('offers no sharing without a home', async () => {
    await openDietary();

    expect(screen.queryByText(t('dietary.sharedWith'))).not.toBeOnTheScreen();
  });
});

describe('a restriction', () => {
  it('is removed once confirmed, by name', async () => {
    const removed = recordMock(RemoveDietaryRestrictionDocument, {
      held: true,
    });
    await openDietary({ answers: [removed] });

    act(() => {
      screen.UNSAFE_getByType(DietaryRestrictionSelector).props.onRemove({
        id: 'r-veg',
        label: 'Vegetarian',
      });
    });
    expect(alertService.alert).toHaveBeenLastCalledWith(
      t('labels.removeNamed', { name: 'Vegetarian' }),
      t('dietary.removeRestrictionConfirm'),
      expect.any(Array),
    );
    await answerAlert(t('labels.remove'));
    await log.requested(RemoveDietaryRestrictionDocument);

    expect(inputOf(removed.fired[0] ?? {})).toMatchObject({ id: 'r-veg' });
  });

  it('says so when its removal fails', async () => {
    await openDietary({
      answers: [
        recordMock(RemoveDietaryRestrictionDocument, {
          error: new Error('boom'),
        }),
      ],
    });
    act(() => {
      screen.UNSAFE_getByType(DietaryRestrictionSelector).props.onRemove({
        id: 'r-veg',
        label: 'Vegetarian',
      });
    });

    await answerAlert(t('labels.remove'));
    await log.landed(RemoveDietaryRestrictionDocument);
    await act(async () => undefined);

    expect(alertService.alert).toHaveBeenLastCalledWith(
      t('labels.error'),
      t('dietary.removeRestrictionFailed'),
    );
  });

  it('reads as not added when one of several fails', async () => {
    await openDietary({
      answers: [
        recordMock(AddDietaryRestrictionDocument, {
          error: new Error('boom'),
          maxUsageCount: 1,
        }),
      ],
    });

    let added: unknown;
    await act(async () => {
      added = await screen
        .UNSAFE_getByType(DietaryRestrictionSelector)
        .props.onAdd([{ diet: Diet.GlutenFree }], RestrictionSeverity.Allergy);
    });

    expect(added).toBe(false);
  });
});

describe('a diet change', () => {
  it('keeps the old diet when the new one cannot be added, and says so', async () => {
    const removed = recordMock(RemoveDietaryRestrictionDocument, {
      held: true,
    });
    await openDietary({
      answers: [
        recordMock(AddDietaryRestrictionDocument, { error: new Error('boom') }),
        removed,
      ],
    });

    let changed: unknown;
    await act(async () => {
      changed = await screen
        .UNSAFE_getByType(DietaryRestrictionSelector)
        .props.onChangeDiets([Diet.Vegan], ['r-veg']);
    });

    expect(changed).toBe(false);
    expect(removed.fired).toEqual([]);
  });

  it('says so when the old diet cannot be removed', async () => {
    await openDietary({
      answers: [
        recordMock(RemoveDietaryRestrictionDocument, {
          error: new Error('boom'),
        }),
      ],
    });

    await act(async () => {
      await screen
        .UNSAFE_getByType(DietaryRestrictionSelector)
        .props.onChangeDiets([], ['r-veg']);
    });

    expect(alertService.alert).toHaveBeenLastCalledWith(
      t('labels.error'),
      t('dietary.removeRestrictionFailed'),
    );
  });
});

describe('its settings', () => {
  it('saves a religious diet', async () => {
    const saved = updated();
    await openDietary({ answers: [saved] });

    act(() => {
      screen
        .UNSAFE_getByType(ReligiousDietPicker)
        .props.onChange(ReligiousDiet.Halal);
    });
    await log.requested(UpdateDietaryProfileDocument);

    expect(inputOf(saved.fired[0] ?? {})).toMatchObject({
      religiousDiet: ReligiousDiet.Halal,
    });
  });

  it.each([
    [
      'cooking preferences',
      'labels.cookingPreferences',
      () => screen.UNSAFE_getByType(CookingPreferencesSheet),
    ],
    [
      'macro targets',
      'macroTargets.title',
      () => screen.UNSAFE_getByType(MacroTargetsSheet),
    ],
  ] as const)('closes the %s editor once saved', async (_, name, sheet) => {
    await openDietary({ answers: [updated()] });
    await userEvent
      .setup()
      .press(screen.getByLabelText(t('a11y.editNamed', { name: t(name) })));
    expect(sheet().props.visible).toBe(true);

    await act(async () => {
      await sheet().props.onSave({});
    });

    expect(sheet().props.visible).toBe(false);
  });
});
