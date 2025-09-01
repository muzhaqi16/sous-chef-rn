import {Alert} from 'react-native';
import NavigationService from '#/services/NavigationService';
import {OnBoardingSteps} from '#store/slices/preferencesSlice';

// Navigation helpers
export const navigateToNextStep = (
  user: any,
  setUserNavigationState: (userId: string, state: any) => void,
  setOnBoardingStep: (step: OnBoardingSteps) => void,
  saveUserProgress: (progress: any) => void,
) => {
  if (user?.id) {
    setUserNavigationState(user.id, {
      onboardingProgress: OnBoardingSteps.createShoppingList,
    });
  }

  setOnBoardingStep(OnBoardingSteps.createShoppingList);
  saveUserProgress({
    onboardingProgress: OnBoardingSteps.createShoppingList,
  });

  NavigationService.navigate('CreateShoppingList');
};

// Resource checking helpers
export const checkExistingResources = async (
  homes: any[],
  pantries: any[],
  callbacks: {
    onComplete: () => void;
    onBothExist: () => void;
    setSelectedHomeId: (id: string) => void;
    setSelectedPantryId: (id: string) => void;
  },
) => {
  if (homes.length > 0) {
    const existingHome = homes[0];
    console.log('Found existing home:', existingHome.id);
    callbacks.setSelectedHomeId(existingHome.id);

    if (pantries.length > 0) {
      const existingPantry = pantries.find(p => p.isDefault) || pantries[0];
      console.log('Found existing pantry:', existingPantry.id);
      callbacks.setSelectedPantryId(existingPantry.id);

      // Both exist - skip to next step
      callbacks.onBothExist();
      return true;
    }
  }

  callbacks.onComplete();
  return false;
};

// Pantry creation helper
export const createPantryForHome = async (
  homeId: string,
  pantryName: string,
  createPantry: any,
  setSelectedPantryId: (id: string) => void,
): Promise<boolean> => {
  try {
    const result = await createPantry({
      variables: {
        input: {
          homeId,
          name: pantryName,
          description: 'Default pantry',
          isDefault: true,
          tags: ['default', 'onboarding'],
        },
      },
    });

    if (result.data?.createPantry) {
      console.log('Pantry created:', result.data.createPantry.id);
      setSelectedPantryId(result.data.createPantry.id);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to create pantry:', error);
    return false;
  }
};

// Alert helpers
export const showPantryCreationError = (onContinue: () => void) => {
  Alert.alert(
    'Notice',
    'Pantry creation failed but you can create it later from settings.',
    [{text: 'Continue', onPress: onContinue}],
  );
};

export const showSkipPantryWarning = (onSkip: () => void) => {
  Alert.alert(
    'Skip Pantry Creation?',
    'You have a home but no pantry. You can create one later from settings.',
    [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Skip', onPress: onSkip, style: 'destructive'},
    ],
  );
};
