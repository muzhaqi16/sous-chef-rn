import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import type { CreatePantryFn } from '#features/pantry/hooks/useCreatePantry';

interface ResourceWithId {
  id: string;
  isDefault?: boolean;
}

// Resource checking helpers
export const checkExistingResources = async (
  homes: ResourceWithId[],
  pantries: ResourceWithId[],
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
  createPantry: CreatePantryFn,
  setSelectedPantryId: (id: string) => void,
): Promise<boolean> => {
  try {
    const result = await createPantry({
      homeId,
      name: pantryName,
      description: 'Default pantry',
      isDefault: true,
      tags: ['default', 'onboarding'],
    });

    const pantryPayload = result.data?.createPantry;
    if (
      pantryPayload?.__typename === 'CreatePantryPayload' &&
      pantryPayload.pantry
    ) {
      setSelectedPantryId(pantryPayload.pantry.id);
      return true;
    }
    return false;
  } catch (error) {
    errorService.reportError(error, { operation: 'createPantry' });
    return false;
  }
};

// Alert helpers
export const showPantryCreationError = (onContinue: () => void) => {
  alertService.alert(
    t('createHome.pantryFailedTitle'),
    t('createHome.pantryFailedBody'),
    [{ text: t('labels.continue'), onPress: onContinue }],
  );
};

export const showSkipPantryWarning = (onSkip: () => void) => {
  alertService.alert(
    t('createHome.skipPantryTitle'),
    t('createHome.skipPantryBody'),
    [
      { text: t('labels.cancel'), style: 'cancel' },
      { text: t('labels.skip'), onPress: onSkip, style: 'destructive' },
    ],
  );
};
