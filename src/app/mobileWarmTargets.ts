import { operationNameOf } from '#/apollo/utils/documentOperation';
import type { WarmTarget } from '#bootstrap/useOfflineTabPreloading';
import { GetMealPlanDocument } from '#features/mealPlan/screens/useMealPlan.generated';
import { warmPlannedMeals } from '#features/mealPlan/screens/warmPlannedMeals';

/** What this host's screens read and the core's warm-up cannot name. */
export const MOBILE_WARM_TARGETS: WarmTarget[] = [
  { name: operationNameOf(GetMealPlanDocument), warm: warmPlannedMeals },
];
