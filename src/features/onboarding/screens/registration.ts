import { createNativeStackScreen } from '@react-navigation/native-stack';
import {
  ReceiptReviewScreen,
  ReceiptScanScreen,
} from '#features/receipts/screens/registration';
import { topInsetWith } from '#navigation/layouts/TopInsetLayout';
import { OnboardingReceiptExits } from '#features/onboarding/components/OnboardingReceiptExits';
import { OnboardingSetupScreen } from './OnboardingSetupScreen';
import { HouseholdStepScreen } from './HouseholdStepScreen';
import { DietaryStepScreen } from './DietaryStepScreen';
import { ReceiptStepScreen } from './ReceiptStepScreen';
import { SelectPantryItems } from './SelectPantryItems';
import { OnboardingCompleteScreen } from './OnboardingCompleteScreen';

// The receipts feature's own screens, given onboarding's exits.
const receiptLayout = topInsetWith(OnboardingReceiptExits);

/**
 * The onboarding stack's screens, spread into `OnboardingStack`. Must stay a
 * literal — react-navigation infers per-screen param types only from one.
 * `linking: null` differs from omitting a key: linking runs in `auto` mode and
 * would otherwise derive a path from the screen name.
 */
export const onboardingScreens = {
  OnboardingSetup: createNativeStackScreen({
    screen: OnboardingSetupScreen,
    linking: 'onboarding/setup',
  }),
  Household: createNativeStackScreen({
    screen: HouseholdStepScreen,
    linking: 'onboarding/household',
  }),
  Dietary: createNativeStackScreen({
    screen: DietaryStepScreen,
    linking: 'onboarding/dietary',
  }),
  Receipt: createNativeStackScreen({
    screen: ReceiptStepScreen,
    linking: 'onboarding/receipt',
  }),
  OnboardingReceiptScan: createNativeStackScreen({
    screen: ReceiptScanScreen,
    linking: null,
    layout: receiptLayout,
  }),
  OnboardingReceiptReview: createNativeStackScreen({
    screen: ReceiptReviewScreen,
    linking: null,
    layout: receiptLayout,
  }),
  Staples: createNativeStackScreen({
    screen: SelectPantryItems,
    linking: 'onboarding/staples',
  }),
  OnboardingComplete: createNativeStackScreen({
    screen: OnboardingCompleteScreen,
    linking: 'onboarding/complete',
  }),
};
