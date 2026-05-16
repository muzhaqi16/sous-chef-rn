import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { alertService } from '#/services/alertService';
import { StyleSheet } from 'react-native-unistyles';
import type { IconTone } from '#utils/iconUtils';
import { format, parseISO } from 'date-fns';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { NutritionSummaryCard } from './NutritionSummaryCard';
import { Icon } from '#utils/iconUtils';
import { type MealPlanFullFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import type { MealPlanPermissions } from '#utils/permissions/mealPlanPermissions';
import { Text } from '#components/atoms/Text';

interface MealPlanSettingsSheetProps {
  visible: boolean;
  mealPlan: MealPlanFullFragment | null;
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
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        actionStyles.item,
        pressed && actionStyles.pressed,
      ]}
      disabled={disabled}
    >
      <Icon name={icon} size={22} tone={tone} />
      <View style={actionStyles.content}>
        <Text size="md" weight="medium" style={actionStyles.label}>
          {label}
        </Text>
        {!!description && (
          <Text size="sm" tone="secondary" style={actionStyles.description}>
            {description}
          </Text>
        )}
      </View>
      <Icon name="chevron-forward" size={18} tone="textTertiary" />
    </Pressable>
  );
}

export const MealPlanSettingsSheet: React.FC<MealPlanSettingsSheetProps> = ({
  visible,
  mealPlan,
  permissions,
  onClose,
  onDuplicate,
  onGenerateShoppingList,
  onDelete,
  deleting,
}) => {
  const { t } = useTranslation();
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['80%'],
  });

  const [showNutrition, setShowNutrition] = useState(false);

  const handleDelete = () => {
    if (!mealPlan) return;
    alertService.alert(
      t('mealPlanSettings.deleteTitle'),
      t('mealPlanSettings.deleteConfirm', { name: mealPlan.name }),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('mealPlanSettings.delete'),
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

  const dateRange = `${format(
    parseISO(mealPlan.startDate),
    'MMM d',
  )} - ${format(parseISO(mealPlan.endDate), 'MMM d, yyyy')}`;

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        <BottomSheetHeader
          title={t('mealPlanSettings.planSettings')}
          onCancel={onClose}
          onConfirm={onClose}
          confirmLabel={t('mealPlanSettings.done')}
        />

        {/* Plan info */}
        <View style={styles.planInfo}>
          <Text size="lg" weight="bold">
            {mealPlan.name}
          </Text>
          {mealPlan.description ? (
            <Text size="sm" tone="secondary">
              {mealPlan.description}
            </Text>
          ) : null}
          <Text size="sm" tone="tertiary" style={styles.planDate}>
            {dateRange}
          </Text>
          {!!mealPlan.home?.name && (
            <Text size="sm" tone="tertiary" style={styles.planDate}>
              {t('mealPlanSettings.sharedWith', { name: mealPlan.home.name })}
            </Text>
          )}
          {!!mealPlan.createdBy?.profile?.displayName && (
            <Text size="sm" tone="tertiary" style={styles.planDate}>
              {t('mealPlanSettings.createdBy', {
                name: mealPlan.createdBy.profile.displayName,
              })}
            </Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text
            size="xs"
            weight="semibold"
            tone="tertiary"
            style={styles.sectionTitle}
          >
            {t('mealPlanSettings.actionsLabel')}
          </Text>
          <View style={styles.actionsCard}>
            <ActionItem
              icon="cart-outline"
              label={t('mealPlanSettings.generateShoppingList')}
              description={t('mealPlanSettings.generateShoppingListDesc')}
              onPress={() => {
                onClose();
                onGenerateShoppingList();
              }}
            />
            {permissions.canDuplicate ? (
              <>
                <View style={styles.divider} />
                <ActionItem
                  icon="copy-outline"
                  label={t('mealPlanSettings.duplicatePlan')}
                  description={t('mealPlanSettings.duplicatePlanDesc')}
                  onPress={() => {
                    onClose();
                    onDuplicate();
                  }}
                />
              </>
            ) : null}
            <View style={styles.divider} />
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
              <Text
                size="xs"
                weight="semibold"
                tone="tertiary"
                style={styles.sectionTitle}
              >
                {t('mealPlanSettings.generatedLists')}
              </Text>
              <View style={styles.actionsCard}>
                {mealPlan.generatedShoppingLists.map(list => (
                  <View key={list.id} style={styles.listRow}>
                    <Icon name="list-outline" size={18} tone="textSecondary" />
                    <Text size="sm" style={styles.listName}>
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
            <Text
              size="xs"
              weight="semibold"
              tone="tertiary"
              style={styles.sectionTitle}
            >
              {t('mealPlanSettings.dangerZone')}
            </Text>
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
      </BottomSheetScrollView>
    </BottomSheetModal>
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
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  planDate: {
    marginTop: theme.spacing.xs,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.md,
  },
  nutritionContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
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
