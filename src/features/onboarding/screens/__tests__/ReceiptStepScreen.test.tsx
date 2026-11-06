'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { t } from '#/i18n';
import { appConfig } from '#/config/appConfig';
import {
  initialOnboardingProgress,
  useOnboardingProgressStore,
} from '#features/onboarding/store/onboardingProgressStore';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import type { OnboardingSetupOutcome } from '#features/onboarding/hooks/useOnboardingSetup';
import type { DataState } from '#hooks/data/useDataState';
import { useStore } from '#store';
import { ReceiptStepScreen } from '../ReceiptStepScreen';

const mockNavigateToNextStep = jest.fn();
const mockNavigateWithinStep = jest.fn();
jest.mock('../useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
    navigateToPreviousStep: jest.fn(),
    navigateWithinStep: mockNavigateWithinStep,
  }),
}));

jest.mock('#features/onboarding/components/OnboardingStepScaffold', () =>
  require('#/test-utils/onboardingStepScaffold'),
);

const mockRun = jest.fn<
  Promise<OnboardingSetupOutcome>,
  [{ createMissingHome: boolean }]
>();
const mockRetryRead = jest.fn();
let mockReadState: DataState = 'ready';
jest.mock('#features/onboarding/hooks/useOnboardingSetup', () => ({
  ...jest.requireActual('#features/onboarding/hooks/useOnboardingSetup'),
  useOnboardingSetup: () => ({
    run: mockRun,
    readState: mockReadState,
    retryRead: mockRetryRead,
  }),
}));
const mockRefetchInvites = jest.fn();
jest.mock('../useOnboardingInvites', () => ({
  useOnboardingInvites: () => ({ refetch: mockRefetchInvites }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingProgressStore.setState({ ...initialOnboardingProgress });
  useStore.setState({ selectedPantryId: 'pantry-1' });
  mockReadState = 'ready';
  mockRun.mockResolvedValue({ status: 'done' });
  delete appConfig.features.receipts;
});

describe('ReceiptStepScreen', () => {
  it('opens the scanner', async () => {
    const user = userEvent.setup();
    render(<ReceiptStepScreen />);

    await user.press(screen.getByText(t('labels.scanReceipt')));

    expect(mockNavigateWithinStep).toHaveBeenCalledWith(
      'OnboardingReceiptScan',
    );
  });

  it('offers staples instead of a scan', async () => {
    const user = userEvent.setup();
    render(<ReceiptStepScreen />);

    await user.press(screen.getByText(t('onBoarding.receiptPickStaples')));

    expect(mockNavigateWithinStep).toHaveBeenCalledWith('Staples');
  });

  it('still offers both after a cancelled scan added nothing', () => {
    // A closed scanner or a refused camera returns here with nothing recorded.
    render(<ReceiptStepScreen />);

    expect(screen.getByText(t('labels.scanReceipt'))).toBeTruthy();
    expect(screen.getByText(t('onBoarding.receiptPickStaples'))).toBeTruthy();
    expect(screen.queryByTestId(onboardingTestIDs.receiptAdded)).toBeNull();
  });

  it('says how many a review added and continues', async () => {
    useOnboardingProgressStore.setState({ receiptItems: 7 });
    const user = userEvent.setup();
    render(<ReceiptStepScreen />);

    expect(
      screen.getByText(t('onBoarding.receiptAdded', { count: 7 })),
    ).toBeTruthy();
    expect(screen.queryByText(t('onBoarding.receiptPickStaples'))).toBeNull();
    await user.press(screen.getByText(t('labels.continue')));

    expect(mockNavigateToNextStep).toHaveBeenCalledWith('Receipt');
  });

  it('offers staples only without the receipts feature', async () => {
    appConfig.features.receipts = false;
    const user = userEvent.setup();
    render(<ReceiptStepScreen />);

    expect(screen.queryByText(t('labels.scanReceipt'))).toBeNull();
    await user.press(screen.getByText(t('onBoarding.receiptPickStaplesOnly')));

    expect(mockNavigateWithinStep).toHaveBeenCalledWith('Staples');
  });

  it('skips with nothing added', async () => {
    const user = userEvent.setup();
    render(<ReceiptStepScreen />);

    await user.press(screen.getByText('Skip'));

    expect(mockNavigateToNextStep).toHaveBeenCalledWith('Receipt');
    expect(mockNavigateWithinStep).not.toHaveBeenCalled();
  });

  describe('before setup has made the pantry', () => {
    beforeEach(() => {
      useStore.setState({ selectedPantryId: null });
    });

    it('waits on setup, offering no scan yet', () => {
      useOnboardingProgressStore.setState({
        setup: { kind: 'running', createMissingHome: true },
      });
      render(<ReceiptStepScreen />);

      expect(
        screen.getByTestId(onboardingTestIDs.receiptSetupRunning),
      ).toBeTruthy();
      expect(screen.queryByText(t('labels.scanReceipt'))).toBeNull();
    });

    it('shows why setup failed, and tries again from here', async () => {
      useOnboardingProgressStore.setState({
        setup: {
          kind: 'failed',
          message: 'The server refused the home.',
          createMissingHome: true,
        },
      });
      const user = userEvent.setup();
      render(<ReceiptStepScreen />);

      expect(screen.getByText('The server refused the home.')).toBeTruthy();
      await user.press(screen.getByText(t('labels.tryAgain')));

      expect(mockRun).toHaveBeenCalledWith({ createMissingHome: true });
      // The retry's outcome is recorded for the step to read.
      expect(useOnboardingProgressStore.getState().setup).toEqual({
        kind: 'done',
      });
    });

    it('offers to read the account again when it could not be read', async () => {
      useOnboardingProgressStore.setState({ setup: { kind: 'owed' } });
      mockReadState = 'offline';
      const user = userEvent.setup();
      render(<ReceiptStepScreen />);

      expect(screen.getByText(t('onBoarding.finishSetupLater'))).toBeTruthy();
      await user.press(screen.getByText(t('labels.tryAgain')));

      expect(mockRetryRead).toHaveBeenCalled();
      expect(mockRefetchInvites).toHaveBeenCalled();
    });

    it('can still be skipped', async () => {
      useOnboardingProgressStore.setState({
        setup: { kind: 'running', createMissingHome: true },
      });
      const user = userEvent.setup();
      render(<ReceiptStepScreen />);

      await user.press(screen.getByText('Skip'));

      expect(mockNavigateToNextStep).toHaveBeenCalledWith('Receipt');
    });
  });
});
