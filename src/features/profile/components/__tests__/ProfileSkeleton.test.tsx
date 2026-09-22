import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { ProfileSkeleton } from '#features/profile/components/ProfileSkeleton';
import { kitTestIDs } from '#components/testIDs';

describe('ProfileSkeleton', () => {
  it('keeps the back control working while the profile loads', async () => {
    const onBack = jest.fn();
    const user = userEvent.setup();
    render(<ProfileSkeleton onBack={onBack} />);

    await user.press(screen.getByTestId(kitTestIDs.headerBackButton));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
