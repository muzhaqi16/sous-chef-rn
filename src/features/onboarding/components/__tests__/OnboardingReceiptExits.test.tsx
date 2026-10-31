'use no memo';
import React from 'react';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { render, screen, userEvent } from '@testing-library/react-native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useReceiptFlowExits } from '#features/receipts/screens/receiptFlowExits';
import {
  initialOnboardingProgress,
  useOnboardingProgressStore,
} from '#features/onboarding/store/onboardingProgressStore';
import { OnboardingReceiptExits } from '../OnboardingReceiptExits';

jest.mock('#hooks/navigation/useAppNavigation');

const mockNavigateToNextStep = jest.fn();
const mockNavigateWithinStep = jest.fn();
jest.mock('#features/onboarding/screens/useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
    navigateToPreviousStep: jest.fn(),
    navigateWithinStep: mockNavigateWithinStep,
  }),
}));

/** Stands in for the scan and review screens, which call these exits. */
function Scanner() {
  const exits = useReceiptFlowExits();
  return (
    <>
      <Pressable onPress={() => exits?.toReview()}>
        <Text>review</Text>
      </Pressable>
      <Pressable onPress={() => exits?.close()}>
        <Text>close</Text>
      </Pressable>
      <Pressable onPress={() => exits?.added(3)}>
        <Text>add three</Text>
      </Pressable>
      <Pressable onPress={() => exits?.finished()}>
        <Text>finish</Text>
      </Pressable>
    </>
  );
}

const renderExits = () =>
  render(
    <OnboardingReceiptExits>
      <Scanner />
    </OnboardingReceiptExits>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingProgressStore.setState({ ...initialOnboardingProgress });
});

describe('OnboardingReceiptExits', () => {
  it("pushes onboarding's own review", async () => {
    const user = userEvent.setup();
    renderExits();

    await user.press(screen.getByText('review'));

    expect(mockNavigateWithinStep).toHaveBeenCalledWith(
      'OnboardingReceiptReview',
    );
  });

  it('closes back to the receipt step', async () => {
    const user = userEvent.setup();
    renderExits();

    await user.press(screen.getByText('close'));

    expect(useAppNavigation().goBack).toHaveBeenCalled();
  });

  it('counts every round a review adds', async () => {
    const user = userEvent.setup();
    renderExits();

    await user.press(screen.getByText('add three'));
    await user.press(screen.getByText('add three'));

    expect(useOnboardingProgressStore.getState().receiptItems).toBe(6);
  });

  it('ends the receipt step once the review is done', async () => {
    const user = userEvent.setup();
    renderExits();

    await user.press(screen.getByText('finish'));

    expect(mockNavigateToNextStep).toHaveBeenCalledWith('Receipt');
  });
});
