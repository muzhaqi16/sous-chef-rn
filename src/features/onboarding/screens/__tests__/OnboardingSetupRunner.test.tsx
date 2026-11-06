import React from 'react';
import { act, render } from '@testing-library/react-native';
import { CommonActions } from '@react-navigation/native';
import type { OnboardingSetupOutcome } from '#features/onboarding/hooks/useOnboardingSetup';
import {
  initialOnboardingProgress,
  useOnboardingProgressStore,
  useOnboardingSetupStore,
} from '#features/onboarding/store/onboardingProgressStore';
import type { DataState } from '#hooks/data/useDataState';
import { OnboardingSetupRunner } from '../OnboardingSetupRunner';
import { routesToResume } from '../useOnboardingNavigation';

const mockRun = jest.fn<
  Promise<OnboardingSetupOutcome>,
  [{ createMissingHome: boolean }]
>();
const mockSetOwed = jest.fn();
let mockSetup: { loading: boolean; hasHome: boolean; readState: DataState } = {
  loading: false,
  hasHome: false,
  readState: 'empty',
};
let mockAnswer = () => {};
jest.mock('#features/onboarding/hooks/useOnboardingSetup', () => ({
  ...jest.requireActual('#features/onboarding/hooks/useOnboardingSetup'),
  useOnboardingSetup: () => {
    const [, setAnswers] = require('react').useState(0);
    mockAnswer = () => setAnswers((answers: number) => answers + 1);
    return { ...mockSetup, run: mockRun, setOwed: mockSetOwed };
  },
}));

let mockInvites: { id: string }[] = [];
let mockInvitesState: DataState = 'empty';
jest.mock('../useOnboardingInvites', () => ({
  useOnboardingInvites: () => ({
    invites: mockInvites,
    loading: false,
    state: mockInvitesState,
  }),
}));

const mockDispatch = jest.fn();
const renderRunner = () =>
  render(<OnboardingSetupRunner navigation={{ dispatch: mockDispatch }} />);

/**
 * Awaits what the runner awaits: the stored progress read (started after the
 * runner's, so it lands after it) and, unless it never answers, the run.
 */
const settle = ({ runAnswers = true } = {}) =>
  act(async () => {
    await routesToResume('Household');
    if (runAnswers) {
      await Promise.all(mockRun.mock.results.map(result => result.value));
    }
  });

const openedInvitations = () =>
  mockDispatch.mock.calls.some(
    ([action]) =>
      JSON.stringify(action) ===
      JSON.stringify(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'OnboardingSetup' }],
        }),
      ),
  );

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingProgressStore.setState({ ...initialOnboardingProgress });
  useOnboardingSetupStore.setState({ setup: { kind: 'reading' } });
  mockSetup = { loading: false, hasHome: false, readState: 'empty' };
  mockInvites = [];
  mockInvitesState = 'empty';
  mockRun.mockResolvedValue({ status: 'done' });
});

describe('OnboardingSetupRunner', () => {
  it('sets up a new account by itself, with no screen before the first question', async () => {
    renderRunner();
    await settle();

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({ createMissingHome: true });
    expect(useOnboardingSetupStore.getState().setup).toEqual({
      kind: 'done',
    });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('says setup is running while it is', async () => {
    mockRun.mockReturnValue(new Promise(() => {}));
    renderRunner();
    await settle({ runAnswers: false });

    expect(useOnboardingSetupStore.getState().setup).toEqual({
      kind: 'running',
      createMissingHome: true,
    });
  });

  it('waits until the account has been read, claiming no setup yet', async () => {
    mockSetup = { loading: true, hasHome: false, readState: 'loading' };
    renderRunner();
    await settle();

    expect(mockRun).not.toHaveBeenCalled();
    expect(useOnboardingSetupStore.getState().setup).toEqual({
      kind: 'reading',
    });
  });

  it('runs once the read answers, and only once', async () => {
    mockSetup = { loading: true, hasHome: false, readState: 'loading' };
    renderRunner();
    await settle();

    mockSetup = { loading: false, hasHome: false, readState: 'empty' };
    await act(async () => mockAnswer());
    await act(async () => mockAnswer());

    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('records a refusal for the kitchen step to show', async () => {
    mockRun.mockResolvedValue({ status: 'failed', message: 'Home limit' });
    renderRunner();
    await settle();

    expect(useOnboardingSetupStore.getState().setup).toEqual({
      kind: 'failed',
      message: 'Home limit',
      createMissingHome: true,
    });
  });

  describe('invitations', () => {
    it('opens the invitations before creating a home', async () => {
      mockInvites = [{ id: 'invite-1' }];
      renderRunner();
      await settle();

      expect(openedInvitations()).toBe(true);
      expect(mockRun).not.toHaveBeenCalled();
      expect(useOnboardingSetupStore.getState().setup).toEqual({
        kind: 'invited',
      });
    });

    it('does not offer them to an account that already has a home', async () => {
      mockSetup = { loading: false, hasHome: true, readState: 'ready' };
      mockInvites = [{ id: 'invite-1' }];
      renderRunner();
      await settle();

      expect(openedInvitations()).toBe(false);
      expect(mockRun).toHaveBeenCalledWith({ createMissingHome: true });
    });

    it('needs none read once the account has a home', async () => {
      mockSetup = { loading: false, hasHome: true, readState: 'ready' };
      mockInvitesState = 'error';
      renderRunner();
      await settle();

      expect(mockRun).toHaveBeenCalledTimes(1);
    });
  });

  describe('an account it could not read', () => {
    it('creates nothing and leaves the setup owed', async () => {
      mockSetup = { loading: false, hasHome: false, readState: 'offline' };
      renderRunner();
      await settle();

      expect(mockRun).not.toHaveBeenCalled();
      expect(mockSetOwed).toHaveBeenCalledWith(true);
      expect(useOnboardingSetupStore.getState().setup).toEqual({
        kind: 'owed',
      });
    });

    it('will not make a home over invitations it could not read', async () => {
      mockInvitesState = 'error';
      renderRunner();
      await settle();

      expect(mockRun).not.toHaveBeenCalled();
      expect(mockSetOwed).toHaveBeenCalledWith(true);
    });
  });

  it('reopens at the furthest question reached, the ones before it behind it', async () => {
    useOnboardingProgressStore.setState({ reachedStep: 'Dietary' });
    renderRunner();
    await settle();

    expect(mockDispatch).toHaveBeenCalledWith(
      CommonActions.reset({
        index: 1,
        routes: [{ name: 'Household' }, { name: 'Dietary' }],
      }),
    );
  });

  it('leaves a first launch on the first question', async () => {
    renderRunner();
    await settle();

    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
