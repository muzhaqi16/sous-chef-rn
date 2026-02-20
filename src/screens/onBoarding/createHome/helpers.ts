import {Alert} from 'react-native';

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
    callbacks.setSelectedHomeId(existingHome.id);

    if (pantries.length > 0) {
      const existingPantry = pantries.find(p => p.isDefault) || pantries[0];
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

    const pantryPayload = result.data?.createPantry;
    if (pantryPayload?.success && pantryPayload.pantry) {
      setSelectedPantryId(pantryPayload.pantry.id);
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
