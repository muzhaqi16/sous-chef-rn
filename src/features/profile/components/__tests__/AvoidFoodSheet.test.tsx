'use no memo';

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { t } from '#/i18n';
import { RestrictionSeverity } from '#/graphql/generated/schemaTypes';
import { profileTestIDs } from '#features/profile/testIDs';
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

let mockItems: Array<{ id: string; name: string; category: null }> = [];
let mockTerm = 'bacon';
jest.mock('#features/catalog/hooks/useItemAutocomplete', () => ({
  useItemAutocomplete: () => ({
    displayItems: mockItems,
    searchTerm: mockTerm,
    isLoading: false,
    handleSearchTermChange: jest.fn(),
    reset: jest.fn(),
  }),
}));

const renderSheet = (added: boolean) => {
  const onDismiss = jest.fn();
  const onPick = jest.fn().mockResolvedValue(added);
  renderWithApollo(
    <AvoidFoodSheet visible onDismiss={onDismiss} onPick={onPick} />,
  );
  return { onDismiss, onPick };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTerm = 'bacon';
  mockItems = [
    { id: 'bacon', name: 'Bacon', category: null },
    { id: 'turkey-bacon', name: 'Turkey Bacon', category: null },
  ];
});

describe('AvoidFoodSheet', () => {
  it('avoids the picked food by default, then closes', async () => {
    const { onDismiss, onPick } = renderSheet(true);

    fireEvent.press(screen.getByText('Bacon'));

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(onPick).toHaveBeenCalledWith(
      'bacon',
      RestrictionSeverity.Preference,
    );
  });

  it('records an allergy when that is chosen first', async () => {
    const { onPick } = renderSheet(true);

    fireEvent.press(
      screen.getByText(t('dietaryProfile.avoidSeverity.allergy')),
    );
    fireEvent.press(screen.getByText('Turkey Bacon'));

    await waitFor(() =>
      expect(onPick).toHaveBeenCalledWith(
        'turkey-bacon',
        RestrictionSeverity.Allergy,
      ),
    );
  });

  it('stays open when the food could not be added', async () => {
    const { onDismiss, onPick } = renderSheet(false);

    fireEvent.press(screen.getByText('Bacon'));

    await waitFor(() => expect(onPick).toHaveBeenCalled());
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('says when nothing matched', () => {
    mockItems = [];
    mockTerm = 'zzz';
    renderSheet(true);

    expect(
      screen.getByText(t('empty.noResultsFor', { query: 'zzz' })),
    ).toBeTruthy();
    expect(screen.getByTestId(profileTestIDs.avoidSheet)).toBeTruthy();
  });
});
