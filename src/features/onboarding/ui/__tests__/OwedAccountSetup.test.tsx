import React from 'react';
import { View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import type { OnboardingSetupOutcome } from '#features/onboarding/hooks/useOnboardingSetup';
import type { DataState } from '#hooks/data/useDataState';
import { useStore } from '#store';
import { OwedAccountSetup } from '../OwedAccountSetup';

const mockRun = jest.fn<
  Promise<OnboardingSetupOutcome>,
  [{ createMissingHome: boolean }]
>();
const mockSetOwed = jest.fn();
let mockSetup: { loading: boolean; hasHome: boolean; readState: DataState };
let mockInvites: { invites: { id: string }[]; state: DataState };

let mockAnswer = () => {};

jest.mock('#features/onboarding/hooks/useOnboardingSetup', () => ({
  useOnboardingSetup: () => {
    const [, setAnswers] = require('react').useState(0);
    mockAnswer = () => setAnswers((answers: number) => answers + 1);
    return { ...mockSetup, run: mockRun, setOwed: mockSetOwed };
  },
}));
jest.mock('#features/onboarding/screens/useOnboardingInvites', () => ({
  useOnboardingInvites: () => ({ ...mockInvites, loading: false }),
}));

const USER = {
  id: 'user-1',
  email: 'test@souschef.dev',
  emailVerified: true,
  onBoarded: false,
};

// It renders nothing, and a renderer needs a tree to hold.
const mount = () =>
  render(
    <View>
      <OwedAccountSetup />
    </View>,
  );

const owe = (accountSetupOwed: boolean) =>
  useStore.setState({
    user: USER,
    userPreferences: {
      [USER.id]: { showShoppingListImages: true, accountSetupOwed },
    },
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockRun.mockResolvedValue({ status: 'done' });
  mockSetup = { loading: false, hasHome: false, readState: 'empty' };
  mockInvites = { invites: [], state: 'empty' };
});

describe('OwedAccountSetup', () => {
  it('does nothing while no setup is owed', () => {
    owe(false);

    mount();

    expect(mockRun).not.toHaveBeenCalled();
  });

  it.each<DataState>(['offline', 'error'])(
    'waits while the account reads %s',
    readState => {
      owe(true);
      mockSetup.readState = readState;

      mount();

      expect(mockRun).not.toHaveBeenCalled();
    },
  );

  it('waits for the invitations too, which may be the answer', () => {
    owe(true);
    mockInvites.state = 'offline';

    mount();

    expect(mockRun).not.toHaveBeenCalled();
  });

  it('finishes setup once the server has answered, then owes nothing', async () => {
    owe(true);
    mockSetup.readState = 'offline';
    mount();

    mockSetup.readState = 'empty';
    await act(async () => {
      mockAnswer();
    });

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({ createMissingHome: true });
    expect(mockSetOwed).toHaveBeenCalledWith(false);
  });

  it('leaves the home to an invitation the account was sent', async () => {
    owe(true);
    mockInvites = { invites: [{ id: 'invite-1' }], state: 'ready' };

    mount();

    expect(mockRun).toHaveBeenCalledWith({ createMissingHome: false });
  });

  it('stays owed when setup fails, for the next launch', async () => {
    owe(true);
    mockRun.mockResolvedValue({ status: 'failed', message: 'no' });

    mount();
    await act(() => mockRun.mock.results[0]?.value);

    expect(mockSetOwed).not.toHaveBeenCalled();
  });
});
