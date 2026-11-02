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

jest.mock('#features/onboarding/components/OnBoardingWrapper', () => ({
  OnBoardingWrapper: ({
    children,
    onSkip,
    primaryAction,
  }: {
    children?: React.ReactNode;
    onSkip?: () => void;
    primaryAction?: React.ReactNode;
  }) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View>
        {children}
        {primaryAction}
        <Pressable onPress={onSkip}>
          <Text>Skip</Text>
        </Pressable>
      </View>
    );
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingProgressStore.setState({ ...initialOnboardingProgress });
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
});
