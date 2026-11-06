'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { t } from '#/i18n';
import { appConfig } from '#/config/appConfig';
import {
  initialOnboardingProgress,
  useOnboardingProgressStore,
  useOnboardingSetupStore,
} from '#features/onboarding/store/onboardingProgressStore';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { StorageState } from '#/graphql/generated/schemaTypes';
import type { useStaplesSelection } from '#features/onboarding/hooks/useStaplesSelection';
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
type Staples = ReturnType<typeof useStaplesSelection>;
const mockToggle = jest.fn();
const mockSave = jest.fn<Promise<void>, []>();
const mockRetry = jest.fn();
let mockStaples: Partial<Staples> = {};
const staplesWith = (overrides: Partial<Staples> = {}): Partial<Staples> => ({
  state: 'ready',
  groups: [
    {
      state: StorageState.Refrigerated,
      labelKey: 'storageStateShort.REFRIGERATED',
      items: [
        {
          id: 'milk',
          name: 'Milk',
          imageUrl: null,
          storageState: StorageState.Refrigerated,
          selected: false,
        },
      ],
    },
  ] as Staples['groups'],
  selectedCount: 0,
  isMaxReached: false,
  hasChanges: false,
  isFirstVisit: true,
  saving: false,
  toggle: mockToggle,
  save: mockSave,
  retry: mockRetry,
  ...overrides,
});
jest.mock('#features/onboarding/hooks/useStaplesSelection', () => ({
  useStaplesSelection: () => mockStaples,
}));
let mockOffline = false;
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: () => mockOffline,
}));
const mockRefetchInvites = jest.fn();
jest.mock('../useOnboardingInvites', () => ({
  useOnboardingInvites: () => ({ refetch: mockRefetchInvites }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingProgressStore.setState({ ...initialOnboardingProgress });
  useOnboardingSetupStore.setState({ setup: { kind: 'reading' } });
  useStore.setState({ selectedPantryId: 'pantry-1' });
  mockReadState = 'ready';
  mockStaples = staplesWith();
  mockOffline = false;
  mockSave.mockResolvedValue(undefined);
  mockRun.mockResolvedValue({ status: 'done' });
  delete appConfig.features.receipts;
});

describe('ReceiptStepScreen', () => {
  it('offers the scan and the staples on one screen', () => {
    render(<ReceiptStepScreen />);

    expect(screen.getByText(t('labels.scanReceipt'))).toBeTruthy();
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText(t('onBoarding.staplesAssumedBasics'))).toBeTruthy();
  });

  it('opens the scanner', async () => {
    const user = userEvent.setup();
    render(<ReceiptStepScreen />);

    await user.press(screen.getByText(t('labels.scanReceipt')));

    expect(mockNavigateWithinStep).toHaveBeenCalledWith(
      'OnboardingReceiptScan',
    );
  });

  it('picks a staple with a tap', async () => {
    const user = userEvent.setup();
    render(<ReceiptStepScreen />);

    await user.press(screen.getByText('Milk'));

    expect(mockToggle).toHaveBeenCalledWith('milk');
  });

  it('adds the staples picked, then moves on', async () => {
    mockStaples = staplesWith({ hasChanges: true, selectedCount: 3 });
    const user = userEvent.setup();
    render(<ReceiptStepScreen />);

    await user.press(
      screen.getByText(t('onBoarding.addItemPlural', { count: 3 })),
    );

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('Receipt');
  });

  it('saves a change on a return, then moves on', async () => {
    mockStaples = staplesWith({ hasChanges: true, isFirstVisit: false });
    const user = userEvent.setup();
    render(<ReceiptStepScreen />);

    await user.press(screen.getByText(t('labels.saveChanges')));

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('Receipt');
  });

  it('continues with nothing picked', async () => {
    const user = userEvent.setup();
    render(<ReceiptStepScreen />);

    await user.press(screen.getByText(t('labels.continue')));

    expect(mockSave).not.toHaveBeenCalled();
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('Receipt');
  });

  it('keeps the staples after a cancelled scan or a refused camera', () => {
    // Either returns here with nothing recorded.
    render(<ReceiptStepScreen />);

    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.queryByTestId(onboardingTestIDs.receiptAdded)).toBeNull();
  });

  it('says how many a review added, and offers another scan', () => {
    useOnboardingProgressStore.setState({ receiptItems: 7 });
    render(<ReceiptStepScreen />);

    expect(
      screen.getByText(t('onBoarding.receiptAdded', { count: 7 })),
    ).toBeTruthy();
    expect(screen.getByText(t('receipts.saved.scanAnother'))).toBeTruthy();
  });

  it('offers staples only without the receipts feature', () => {
    appConfig.features.receipts = false;
    render(<ReceiptStepScreen />);

    expect(screen.queryByText(t('labels.scanReceipt'))).toBeNull();
    expect(
      screen.getByText(t('onBoarding.receiptStaplesOnlySubtitle')),
    ).toBeTruthy();
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('offers to read the staples again when they failed', async () => {
    mockStaples = staplesWith({ state: 'failed' });
    const user = userEvent.setup();
    render(<ReceiptStepScreen />);

    await user.press(screen.getByText(t('labels.tryAgain')));

    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('says offline that scanning and staples need a connection, and Skip continues', async () => {
    mockOffline = true;
    const user = userEvent.setup();
    render(<ReceiptStepScreen />);

    expect(screen.getByText(t('onBoarding.kitchenOffline'))).toBeTruthy();
    expect(screen.queryByText(t('labels.scanReceipt'))).toBeNull();
    expect(screen.queryByText('Milk')).toBeNull();
    await user.press(screen.getByText('Skip'));

    expect(mockNavigateToNextStep).toHaveBeenCalledWith('Receipt');
  });

  it('skips with nothing added', async () => {
    const user = userEvent.setup();
    render(<ReceiptStepScreen />);

    await user.press(screen.getByText('Skip'));

    expect(mockNavigateToNextStep).toHaveBeenCalledWith('Receipt');
    expect(mockSave).not.toHaveBeenCalled();
  });

  describe('before setup has made the pantry', () => {
    beforeEach(() => {
      useStore.setState({ selectedPantryId: null });
    });

    it('waits on setup, offering no scan yet', () => {
      useOnboardingSetupStore.setState({
        setup: { kind: 'running', createMissingHome: true },
      });
      render(<ReceiptStepScreen />);

      expect(
        screen.getByTestId(onboardingTestIDs.receiptSetupRunning),
      ).toBeTruthy();
      expect(screen.queryByText(t('labels.scanReceipt'))).toBeNull();
    });

    it('shows why setup failed, and tries again from here', async () => {
      useOnboardingSetupStore.setState({
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
      expect(useOnboardingSetupStore.getState().setup).toEqual({
        kind: 'done',
      });
    });

    it('offers to read the account again when it could not be read', async () => {
      useOnboardingSetupStore.setState({ setup: { kind: 'owed' } });
      mockReadState = 'offline';
      const user = userEvent.setup();
      render(<ReceiptStepScreen />);

      expect(screen.getByText(t('onBoarding.finishSetupLater'))).toBeTruthy();
      await user.press(screen.getByText(t('labels.tryAgain')));

      expect(mockRetryRead).toHaveBeenCalled();
      expect(mockRefetchInvites).toHaveBeenCalled();
    });

    it('can still be skipped', async () => {
      useOnboardingSetupStore.setState({
        setup: { kind: 'running', createMissingHome: true },
      });
      const user = userEvent.setup();
      render(<ReceiptStepScreen />);

      await user.press(screen.getByText('Skip'));

      expect(mockNavigateToNextStep).toHaveBeenCalledWith('Receipt');
    });
  });
});
