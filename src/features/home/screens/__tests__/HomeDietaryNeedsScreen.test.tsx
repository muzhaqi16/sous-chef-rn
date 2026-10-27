import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import {
  MembershipRole,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import type { MemberDietaryNeeds } from '#features/home/hooks/useHomeDietaryNeeds';
import { homeTestIDs } from '#features/home/testIDs';
import { HomeDietaryNeedsScreen } from '../HomeDietaryNeedsScreen';

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#store/useAppStore', () => ({
  useUser: () => ({ id: 'u-me' }),
}));
jest.mock('#components/templates/SubScreen', () => {
  const { View, Text } = require('react-native');
  return {
    SubScreen: ({
      children,
      title,
      testID,
    }: {
      children?: React.ReactNode;
      title?: string;
      testID?: string;
    }) => (
      <View testID={testID}>
        <Text>{title}</Text>
        {children}
      </View>
    ),
  };
});

const mockNeeds: {
  members: MemberDietaryNeeds[];
  state: 'ready' | 'empty';
} = { members: [], state: 'empty' };
jest.mock('#features/home/hooks/useHomeDietaryNeeds', () => ({
  useHomeDietaryNeeds: () => ({ ...mockNeeds, retry: jest.fn() }),
}));

const route = {
  key: 'HomeDietaryNeeds',
  name: 'HomeDietaryNeeds',
  params: { homeId: 'home-1' },
};

describe('HomeDietaryNeedsScreen', () => {
  beforeEach(() => {
    mockNeeds.members = [];
    mockNeeds.state = 'empty';
  });

  it('names each sharing member, the user as You, under what each need asks', () => {
    mockNeeds.state = 'ready';
    mockNeeds.members = [
      {
        membershipId: 'm-ana',
        userId: 'u-ana',
        role: MembershipRole.Member,
        displayName: 'Ana',
        restrictions: [
          {
            id: 'r-1',
            label: t('recipes.intolerance.PEANUT'),
            kind: 'avoid',
            severity: RestrictionSeverity.Allergy,
          },
          {
            id: 'r-2',
            label: 'Bacon',
            kind: 'avoid',
            severity: RestrictionSeverity.Preference,
          },
          {
            id: 'r-4',
            label: t('recipes.diet.VEGAN'),
            kind: 'diet',
            severity: RestrictionSeverity.Preference,
          },
        ],
      },
      {
        membershipId: 'm-me',
        userId: 'u-me',
        role: MembershipRole.Owner,
        displayName: 'Tani',
        restrictions: [
          {
            id: 'r-3',
            label: t('recipes.healthGoal.LOW_CARB'),
            kind: 'goal',
            severity: RestrictionSeverity.Goal,
          },
        ],
      },
    ];
    render(<HomeDietaryNeedsScreen route={route} />);

    expect(
      screen.getByTestId(homeTestIDs.dietaryNeedsMember('m-ana')),
    ).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText(t('homeDetail.youLabel'))).toBeTruthy();
    expect(screen.queryByText('Tani')).toBeNull();
    expect(
      screen.getByText(t('homeDietaryNeeds.group.allergicTo')),
    ).toBeTruthy();
    expect(screen.getByText(t('recipes.intolerance.PEANUT'))).toBeTruthy();
    // A food picked at preference is avoided; a diet beside it is followed.
    expect(screen.getByText(t('homeDietaryNeeds.group.avoids'))).toBeTruthy();
    expect(screen.getByText(t('homeDietaryNeeds.group.follows'))).toBeTruthy();
    expect(screen.getByText(t('homeDietaryNeeds.group.goals'))).toBeTruthy();
    expect(
      screen.queryByText(t('homeDietaryNeeds.group.intolerantTo')),
    ).toBeNull();
  });

  it('says how sharing is turned on when nobody shares', () => {
    render(<HomeDietaryNeedsScreen route={route} />);

    expect(screen.getByText(t('homeDietaryNeeds.emptyTitle'))).toBeTruthy();
    expect(screen.getByText(t('homeDietaryNeeds.emptyBody'))).toBeTruthy();
  });
});
