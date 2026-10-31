'use no memo';

import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { t } from '#/i18n';
import { RestrictionSeverity } from '#/graphql/generated/schemaTypes';
import { profileTestIDs } from '#features/profile/testIDs';
import { SearchAvoidableFoodsDocument } from '#features/profile/ui/useAvoidFoodSearch.generated';
import { AvoidFoodSheet } from '../AvoidFoodSheet';

jest.mock('#hooks/ui/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
  })),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
}));

const searchMock = () =>
  recordMock(SearchAvoidableFoodsDocument, {
    data: {
      searchItems: {
        edges: [
          { node: { id: 'bacon', name: 'Bacon' } },
          { node: { id: 'turkey-bacon', name: 'Turkey Bacon' } },
        ],
      },
    },
  });

const sheet = (
  visible: boolean,
  onPick: (
    food: { id: string; name: string },
    severity: RestrictionSeverity,
  ) => Promise<boolean>,
  onDismiss = jest.fn(),
) => <AvoidFoodSheet visible={visible} onDismiss={onDismiss} onPick={onPick} />;

const searchFor = async (term: string) => {
  fireEvent.changeText(
    screen.getByTestId(profileTestIDs.avoidSearchInput),
    term,
  );
  await drainTimers();
  expect(screen.getByText('Bacon')).toBeTruthy();
};

const renderSheet = async (added: boolean) => {
  const onDismiss = jest.fn();
  const onPick = jest.fn().mockResolvedValue(added);
  renderWithApollo(sheet(true, onPick, onDismiss), {
    operationMocks: [searchMock().mock],
  });
  await searchFor('bacon');
  return { onDismiss, onPick };
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AvoidFoodSheet', () => {
  it('avoids the picked food by default, then closes', async () => {
    const { onDismiss, onPick } = await renderSheet(true);

    fireEvent.press(screen.getByText('Bacon'));

    await drainTimers();
    expect(onDismiss).toHaveBeenCalled();
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'bacon', name: 'Bacon' }),
      RestrictionSeverity.Preference,
    );
  });

  it('records an allergy when that is chosen first', async () => {
    const { onPick } = await renderSheet(true);

    fireEvent.press(
      screen.getByText(t('dietaryProfile.avoidSeverity.allergy')),
    );
    fireEvent.press(screen.getByText('Turkey Bacon'));

    await drainTimers();
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'turkey-bacon' }),
      RestrictionSeverity.Allergy,
    );
  });

  it('opens again at the mildest severity', async () => {
    const onPick = jest.fn().mockResolvedValue(true);
    const { rerender } = renderWithApollo(sheet(true, onPick), {
      operationMocks: [searchMock().mock],
    });
    fireEvent.press(
      screen.getByText(t('dietaryProfile.avoidSeverity.allergy')),
    );

    rerender(sheet(false, onPick));
    rerender(sheet(true, onPick));
    await searchFor('bacon');
    fireEvent.press(screen.getByText('Bacon'));

    await drainTimers();
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'bacon' }),
      RestrictionSeverity.Preference,
    );
  });

  it('stays open when the food could not be added', async () => {
    const { onDismiss, onPick } = await renderSheet(false);

    fireEvent.press(screen.getByText('Bacon'));

    await drainTimers();
    expect(onPick).toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
