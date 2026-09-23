import React from 'react';
import { Text } from '#components/atoms/Text';
import { render, screen, userEvent } from '@testing-library/react-native';
import { AuthWrapper } from '#features/auth/components/AuthWrapper';
import { kitTestIDs } from '#components/testIDs';

describe('AuthWrapper', () => {
  it('puts back in the standard header when there is somewhere to go', async () => {
    const onBack = jest.fn();
    const user = userEvent.setup();
    render(
      <AuthWrapper onBack={onBack}>
        <Text role="body">form</Text>
      </AuthWrapper>,
    );

    await user.press(screen.getByTestId(kitTestIDs.headerBackButton));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows no header on a root auth screen', () => {
    render(
      <AuthWrapper>
        <Text role="body">form</Text>
      </AuthWrapper>,
    );

    expect(screen.queryByTestId(kitTestIDs.headerBackButton)).toBeNull();
    expect(screen.getByText('form')).toBeTruthy();
  });
});
