import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import { profileTestIDs } from '#features/profile/testIDs';
import { DietarySharingSection } from '../DietarySharingSection';

const onChange = jest.fn().mockResolvedValue(undefined);

describe('DietarySharingSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('says who sees the restrictions once one home shares', () => {
    render(
      <DietarySharingSection
        homes={[
          { id: 'home-1', name: 'Test Home', shared: true },
          { id: 'home-2', name: 'Beach House', shared: false },
        ]}
        onChange={onChange}
      />,
    );

    expect(screen.getByText(t('dietary.sharedWithShown'))).toBeTruthy();
    expect(screen.getByText('Test Home')).toBeTruthy();
    expect(screen.getByText('Beach House')).toBeTruthy();
  });

  it('invites turning a home on when none shares, as for homes joined before', () => {
    render(
      <DietarySharingSection
        homes={[{ id: 'home-1', name: 'Test Home', shared: false }]}
        onChange={onChange}
      />,
    );

    expect(screen.getByText(t('dietary.sharedWithNone'))).toBeTruthy();
    expect(screen.queryByText(t('dietary.sharedWithShown'))).toBeNull();
  });

  it('flips one home’s switch', () => {
    render(
      <DietarySharingSection
        homes={[
          { id: 'home-1', name: 'Test Home', shared: false },
          { id: 'home-2', name: 'Beach House', shared: true },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent(
      screen.getByTestId(profileTestIDs.dietarySharingSwitch('home-1')),
      'valueChange',
      true,
    );

    expect(onChange).toHaveBeenCalledWith('home-1', true);
  });
});
