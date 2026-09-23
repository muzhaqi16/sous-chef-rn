import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import type { CreatePantryFn } from '#features/pantry/hooks/useCreatePantry';

/**
 * The create is local-first, so the id it minted is the pantry's id whether the
 * server answered or the write is queued — reading the payload would report a
 * queued create as a failure and dead-end onboarding offline.
 */
export const createPantryForHome = async (
  homeId: string,
  pantryName: string,
  createPantry: CreatePantryFn,
  setSelectedPantryId: (id: string) => void,
): Promise<boolean> => {
  try {
    const outcome = await createPantry({
      homeId,
      name: pantryName,
      description: t('onBoarding.defaultPantryDescription'),
      isDefault: true,
      tags: ['default', 'onboarding'],
    });

    if (outcome.status === 'rejected') return false;
    setSelectedPantryId(outcome.id);
    return true;
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
