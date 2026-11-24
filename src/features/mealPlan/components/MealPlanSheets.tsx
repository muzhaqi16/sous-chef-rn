import React from 'react';
import { useTranslation } from '#/i18n';
import type { MealType } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { AddMealSheet } from '#features/mealPlan/components/AddMealSheet';
import { DuplicatePlanSheet } from '#features/mealPlan/components/DuplicatePlanSheet';
import { GenerateShoppingListSheet } from '#features/mealPlan/components/GenerateShoppingListSheet';
import { MealPlanSettingsSheet } from '#features/mealPlan/components/MealPlanSettingsSheet';
import { PlannedMealCook } from '#features/mealPlan/components/PlannedMealCook';
import { SaveAsTemplateSheet } from '#features/mealPlan/components/SaveAsTemplateSheet';
import { TemplateSheets } from '#features/mealPlan/components/TemplateSheets';
import { useDuplicateMealPlan } from '#features/mealPlan/hooks/useDuplicateMealPlan';
import { useGenerateShoppingList } from '#features/mealPlan/hooks/useGenerateShoppingList';
import { useMealPlanActions } from '#features/mealPlan/hooks/useMealPlanActions';
import type { useMealPlanDisplay } from '#features/mealPlan/hooks/useMealPlans';
import type { useMealPlanPermissions } from '#features/mealPlan/hooks/useMealPlanPermissions';
import { useMealTemplateActions } from '#features/mealPlan/hooks/useMealTemplateActions';
import type { ActiveMealPlan } from '#features/mealPlan/screens/useActiveMealPlan';
import type { MealPlanItemHandlers } from '#features/mealPlan/screens/useMealPlanItemHandlers';
import type { ActiveSheet } from '#hooks/ui/useActiveSheet';
import { useAppStore } from '#store/useAppStore';

export type MealPlanSheet =
  | { type: 'addMeal'; mealType?: MealType }
  | { type: 'cook' }
  | { type: 'saveTemplate' }
  | { type: 'templates' }
  | { type: 'shoppingList' }
  | { type: 'settings' }
  | { type: 'duplicate' };

interface MealPlanSheetsProps {
  sheets: ActiveSheet<MealPlanSheet>;
  plan: ActiveMealPlan;
  /** The active plan in the list's own shape, as the duplicate sheet reads it. */
  display: ReturnType<typeof useMealPlanDisplay>;
  permissions: ReturnType<typeof useMealPlanPermissions>;
  items: MealPlanItemHandlers;
}

/** Every sheet the meal plan screen opens, and the writes only they make. */
export const MealPlanSheets: React.FC<MealPlanSheetsProps> = ({
  sheets: { active, open, close },
  plan,
  display,
  permissions,
  items,
}) => {
  const { t } = useTranslation();
  const setSelectedMealPlanId = useAppStore(s => s.setSelectedMealPlanId);
  const { activePlanId, mealPlan } = plan;
  const { createTemplateFromPlan, creatingTemplate } = useMealTemplateActions();
  const { generateShoppingList, loading: generating } =
    useGenerateShoppingList(activePlanId);
  const { duplicatePlan, loading: duplicating } = useDuplicateMealPlan();
  const { deleteMealPlan, deleting } = useMealPlanActions();

  const handleDeletePlan = async (id: string) => {
    if (!(await deleteMealPlan(id))) return;
    toastService.success(t('mealPlanMain.mealPlanDeleted'));
    // The active plan gone: clear the selection so the screen falls back to
    // the next plan, or the empty state if none remain.
    if (id === activePlanId) setSelectedMealPlanId(null);
  };

  return (
    <>
      <AddMealSheet
        visible={active?.type === 'addMeal'}
        onClose={() => close('addMeal')}
        initialMealType={
          active?.type === 'addMeal' ? active.mealType : undefined
        }
        onAddRecipe={items.addRecipe}
        onAddCustomMeal={items.addCustomMeal}
      />

      <SaveAsTemplateSheet
        visible={active?.type === 'saveTemplate'}
        mealPlanId={activePlanId}
        // Both from the ACTIVE plan: the SELECTED one is what
        // `useActiveMealPlan` falls back from when it is deleted or unshared,
        // so naming from it labels one plan's template with another's name.
        mealPlanName={mealPlan?.name}
        homeName={mealPlan?.home?.name}
        onClose={() => close('saveTemplate')}
        onSave={async input => {
          if (await createTemplateFromPlan(input)) close('saveTemplate');
        }}
        saving={creatingTemplate}
      />

      <TemplateSheets
        browserVisible={active?.type === 'templates'}
        onCloseBrowser={() => close('templates')}
      />

      <GenerateShoppingListSheet
        visible={active?.type === 'shoppingList'}
        onClose={() => close('shoppingList')}
        onGenerate={async options => {
          if (await generateShoppingList(options)) close('shoppingList');
        }}
        loading={generating}
        homeName={mealPlan?.home?.name}
      />

      <MealPlanSettingsSheet
        visible={active?.type === 'settings'}
        mealPlanRef={plan.mealPlanRef}
        permissions={permissions}
        onClose={() => close('settings')}
        onDuplicate={() => open({ type: 'duplicate' })}
        onSaveAsTemplate={() => open({ type: 'saveTemplate' })}
        onDelete={handleDeletePlan}
        deleting={deleting}
      />

      <DuplicatePlanSheet
        visible={active?.type === 'duplicate'}
        // The ACTIVE plan, whose settings opened this sheet: the SELECTED one
        // is a different plan once the active-plan fallback fires.
        mealPlan={display}
        onClose={() => close('duplicate')}
        onDuplicate={async input => {
          if (await duplicatePlan(input)) close('duplicate');
        }}
        loading={duplicating}
      />

      <PlannedMealCook
        meal={items.pendingCook}
        visible={active?.type === 'cook'}
        onClose={() => close('cook')}
        onComplete={items.markCooked}
        onMealChanged={() => {
          void plan.refetch();
        }}
      />
    </>
  );
};
