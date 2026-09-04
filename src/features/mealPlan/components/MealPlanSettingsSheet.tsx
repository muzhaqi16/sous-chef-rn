import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { StyleSheet } from 'react-native-unistyles';
import type { IconTone } from '#utils/iconUtils';
import { parseISO } from 'date-fns';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { NutritionSummaryCard } from './NutritionSummaryCard';
import { Icon } from '#utils/iconUtils';
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import {
  MealPlanSettingsSheet_MealPlanFragmentDoc,
  type MealPlanSettingsSheet_MealPlanFragment,
} from './MealPlanSettingsSheet.generated';
import type { MealPlanPermissions } from '#features/mealPlan/utils/mealPlanPermissions';
import { useDietaryProfile } from '#features/profile/hooks/useDietaryProfile';
import { useMealPlanActions } from '#features/mealPlan/hooks/useMealPlanActions';
import { DEFAULT_CURRENCY, formatCurrency } from '#/utils/formatters/number';
import { Text } from '#components/atoms/Text';
import { formatDateRangeWithYear } from '#/utils/formatters/date';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { Divider } from '#components/atoms/Divider';
import { Sheet } from '#components/templates/Sheet';

interface MealPlanSettingsSheetProps {
  visible: boolean;
  mealPlanRef:
    | FragmentType<typeof MealPlanSettingsSheet_MealPlanFragmentDoc>
    | MealPlanSettingsSheet_MealPlanFragment
    | null;
  permissions: MealPlanPermissions;
  onClose: () => void;
  onDuplicate: () => void;
  onGenerateShoppingList: () => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}

function ActionItem({
  icon,
  label,
  description,
  onPress,
  tone = 'textPrimary',
  disabled,
}: {
  icon: string;
  label: string;
  description?: string;
  onPress: () => void;
  tone?: IconTone;
  disabled?: boolean;
}) {
  actionStyles.useVariants({ tone: tone === 'error' ? 'error' : undefined });
  return (
    <AppPressable
      onPress={onPress}
      style={actionStyles.item}
      disabled={disabled}
    >
      <Icon name={icon} size={22} tone={tone} />
      <View style={actionStyles.content}>
        <Text role="bodyStrong" style={actionStyles.label}>
          {label}
        </Text>
        {!!description && (
          <Text
            role="caption"
            tone="secondary"
            style={actionStyles.description}
          >
            {description}
          </Text>
        )}
      </View>
      <Icon name="chevron-forward" size={18} tone="textTertiary" />
    </AppPressable>
  );
}

export const MealPlanSettingsSheet: React.FC<MealPlanSettingsSheetProps> = ({
  visible,
  mealPlanRef,
  permissions,
  onClose,
  onDuplicate,
  onGenerateShoppingList,
  onDelete,
  deleting,
}) => {
  const { t } = useTranslation();

  // Per-entity cache subscription: re-renders only when this MealPlan's
  // fields change. Falls back to the source prop on cache miss.
  const fragmentResult = useFragment({
    fragment: MealPlanSettingsSheet_MealPlanFragmentDoc,
    fragmentName: 'MealPlanSettingsSheet_mealPlan',
    from: mealPlanRef,
  });
  const mealPlan: MealPlanSettingsSheet_MealPlanFragment | null =
    fragmentResult.complete
      ? fragmentResult.data
      : (mealPlanRef as MealPlanSettingsSheet_MealPlanFragment | null);

  const [showNutrition, setShowNutrition] = useState(false);

  // Nutrition-goal tracking = linking the user's (single) dietary profile to the
  // plan. Linking populates nutritionGoalProgress server-side; the toggle only
  // shows when the user actually has a profile to link.
  const { profile: dietaryProfile } = useDietaryProfile();
  const { updateMealPlan } = useMealPlanActions();
  const isDietaryLinked = !!mealPlan?.dietaryProfile?.id;

  const handleToggleDietary = () => {
    if (!mealPlan || !dietaryProfile) return;
    const nextLinked = !isDietaryLinked;
    updateMealPlan(mealPlan.id, {
      dietaryProfileId: nextLinked ? dietaryProfile.id : null,
    });
    if (nextLinked) setShowNutrition(true);
  };

  const handleDelete = () => {
    if (!mealPlan) return;
    alertService.alert(
      t('mealPlanSettings.deleteTitle'),
      t('labels.areYouSureYouWantToDeleteThisCannotBeUndone', {
        name: mealPlan.name,
      }),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.delete'),
          style: 'destructive',
          onPress: () => {
            onDelete(mealPlan.id);
            onClose();
          },
        },
      ],
    );
  };

  if (!mealPlan) return null;

  const dateRange =
    mealPlan.startDate && mealPlan.endDate
      ? formatDateRangeWithYear(
          parseISO(mealPlan.startDate),
          parseISO(mealPlan.endDate),
        )
      : null;

  return (
    <Sheet
      mode="action"
      visible={visible}
      onDismiss={onClose}
      snapPoints={['80%']}
      contentContainerStyle={styles.contentContainer}
      style={styles.scrollView}
    >
      <BottomSheetHeader
        title={t('mealPlanSettings.planSettings')}
        onCancel={onClose}
        onConfirm={onClose}
        confirmLabel={t('labels.done')}
      />

      {/* Plan info */}
      <View style={styles.planInfo}>
        <Text role="heading">{mealPlan.name}</Text>
        {mealPlan.description ? (
          <Text role="caption" tone="secondary">
            {mealPlan.description}
          </Text>
        ) : null}
        {!!dateRange && (
          <Text role="caption" tone="tertiary" style={styles.planDate}>
            {dateRange}
          </Text>
        )}
        {!!mealPlan.home?.name && (
          <Text role="caption" tone="tertiary" style={styles.planDate}>
            {t('mealPlanSettings.sharedWith', { name: mealPlan.home.name })}
          </Text>
        )}
        {!!mealPlan.createdBy?.profile?.displayName && (
          <Text role="caption" tone="tertiary" style={styles.planDate}>
            {t('mealPlanSettings.createdBy', {
              name: mealPlan.createdBy.profile.displayName,
            })}
          </Text>
        )}
        {mealPlan.budgetAmount != null ? (
          <Text role="caption" tone="tertiary" style={styles.planDate}>
            {t('mealPlanSettings.budgetSpent', {
              spent: formatCurrency(mealPlan.actualCost, DEFAULT_CURRENCY),
              budget: formatCurrency(mealPlan.budgetAmount, DEFAULT_CURRENCY),
            })}
          </Text>
        ) : mealPlan.actualCost > 0 ? (
          <Text role="caption" tone="tertiary" style={styles.planDate}>
            {t('mealPlanSettings.spentAmount', {
              spent: formatCurrency(mealPlan.actualCost, DEFAULT_CURRENCY),
            })}
          </Text>
        ) : null}
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <SectionHeader variant="overline">
          {t('mealPlanSettings.actionsLabel')}
        </SectionHeader>
        <View style={styles.actionsCard}>
          <ActionItem
            icon="cart-outline"
            label={t('labels.generateShoppingList')}
            description={t('mealPlanSettings.generateShoppingListDesc')}
            onPress={() => {
              onClose();
              onGenerateShoppingList();
            }}
          />
          {permissions.canDuplicate ? (
            <>
              <Divider style={styles.dividerGap} />
              <ActionItem
                icon="copy-outline"
                label={t('labels.duplicatePlan')}
                description={t('mealPlanSettings.duplicatePlanDesc')}
                onPress={() => {
                  onClose();
                  onDuplicate();
                }}
              />
            </>
          ) : null}
          <Divider style={styles.dividerGap} />
          <ActionItem
            icon="nutrition-outline"
            label={
              showNutrition
                ? t('mealPlanSettings.hideNutrition')
                : t('mealPlanSettings.viewNutrition')
            }
            description={t('mealPlanSettings.viewNutritionDesc')}
            onPress={() => setShowNutrition(prev => !prev)}
          />
          {!!dietaryProfile && (
            <>
              <Divider style={styles.dividerGap} />
              <ActionItem
                icon="fitness-outline"
                label={
                  isDietaryLinked
                    ? t('mealPlanSettings.nutritionTrackingOn')
                    : t('labels.trackNutritionGoals')
                }
                description={t('mealPlanSettings.trackNutritionDesc')}
                onPress={handleToggleDietary}
              />
            </>
          )}
        </View>
      </View>

      {/* Nutrition details */}
      {!!showNutrition && !!mealPlan.nutritionSummary && (
        <View style={styles.nutritionContainer}>
          <NutritionSummaryCard
            nutritionSummary={mealPlan.nutritionSummary}
            nutritionGoalProgress={mealPlan.nutritionGoalProgress}
          />
        </View>
      )}

      {/* Generated shopping lists */}
      {!!mealPlan.generatedShoppingLists &&
        mealPlan.generatedShoppingLists.length > 0 && (
          <View style={styles.section}>
            <SectionHeader variant="overline">
              {t('mealPlanSettings.generatedLists')}
            </SectionHeader>
            <View style={styles.actionsCard}>
              {mealPlan.generatedShoppingLists.map(list => (
                <View key={list.id} style={styles.listRow}>
                  <Icon name="list-outline" size={18} tone="textSecondary" />
                  <Text role="caption" style={styles.listName}>
                    {list.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

      {/* Danger zone */}
      {permissions.canDelete ? (
        <View style={styles.section}>
          <SectionHeader variant="overline">
            {t('labels.dangerZone')}
          </SectionHeader>
          <View style={styles.actionsCard}>
            <ActionItem
              icon="trash-outline"
              label={
                deleting
                  ? t('mealPlanSettings.deletingLabel')
                  : t('mealPlanSettings.deletePlanLabel')
              }
              description={t('mealPlanSettings.deletePlanDesc')}
              onPress={handleDelete}
              tone="error"
              disabled={deleting}
            />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  planInfo: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  planDate: {
    marginTop: theme.spacing.xs,
  },
  section: {
    gap: theme.spacing.sm,
  },
  actionsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  dividerGap: {
    marginHorizontal: theme.spacing.md,
  },
  nutritionContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  listName: {
    flex: 1,
  },
}));

const actionStyles = StyleSheet.create(theme => ({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  content: {
    flex: 1,
  },
  label: {
    color: theme.colors.textPrimary,
    variants: {
      tone: {
        error: { color: theme.colors.error },
      },
    },
  },
  description: {
    marginTop: 2,
  },
}));
