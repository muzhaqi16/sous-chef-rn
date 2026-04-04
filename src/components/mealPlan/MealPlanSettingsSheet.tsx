import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { alertService } from '#/services/alertService';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { format, parseISO } from 'date-fns';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { NutritionSummaryCard } from './NutritionSummaryCard';
import { Icon } from '#utils/iconUtils';
import type { MealPlanFullFragment } from '#generated';
import type { MealPlanPermissions } from '#utils/permissions/mealPlanPermissions';

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
  color,
  disabled,
}: {
  icon: string;
  label: string;
  description?: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  const { theme } = useUnistyles();
  const iconColor = color ?? theme.colors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        actionStyles.item,
        pressed && actionStyles.pressed,
      ]}
      disabled={disabled}
    >
      <Icon name={icon} size={22} color={iconColor} />
      <View style={actionStyles.content}>
        <Text style={[actionStyles.label, color ? { color } : undefined]}>
          {label}
        </Text>
        {!!description && (
          <Text style={actionStyles.description}>{description}</Text>
        )}
      </View>
      <Icon
        name="chevron-forward"
        size={18}
        color={theme.colors.textTertiary}
      />
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
  const { theme } = useUnistyles();
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['80%'],
  });

  const [showNutrition, setShowNutrition] = useState(false);

  const handleDelete = () => {
    if (!mealPlan) return;
    alertService.alert(
      'Delete Meal Plan',
      `Are you sure you want to delete "${mealPlan.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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
          title="Plan Settings"
          onCancel={onClose}
          onConfirm={onClose}
          confirmLabel="Done"
        />

        {/* Plan info */}
        <View style={styles.planInfo}>
          <Text style={styles.planName}>{mealPlan.name}</Text>
          {mealPlan.description ? (
            <Text style={styles.planDescription}>{mealPlan.description}</Text>
          ) : null}
          <Text style={styles.planDate}>{dateRange}</Text>
          {!!mealPlan.home?.name && (
            <Text style={styles.planDate}>
              Shared with {mealPlan.home.name}
            </Text>
          )}
          {!!mealPlan.createdBy?.profile?.displayName && (
            <Text style={styles.planDate}>
              Created by {mealPlan.createdBy.profile.displayName}
            </Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsCard}>
            <ActionItem
              icon="cart-outline"
              label="Generate Shopping List"
              description="Create a list from this plan's recipes"
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
                  label="Duplicate Plan"
                  description="Copy this plan to a new date range"
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
              label={showNutrition ? 'Hide Nutrition' : 'View Nutrition'}
              description="Calories, macros, and goal progress"
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
              <Text style={styles.sectionTitle}>Generated Lists</Text>
              <View style={styles.actionsCard}>
                {mealPlan.generatedShoppingLists.map(list => (
                  <View key={list.id} style={styles.listRow}>
                    <Icon
                      name="list-outline"
                      size={18}
                      color={theme.colors.textSecondary}
                    />
                    <Text style={styles.listName}>{list.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

        {/* Danger zone */}
        {permissions.canDelete ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>
            <View style={styles.actionsCard}>
              <ActionItem
                icon="trash-outline"
                label={deleting ? 'Deleting...' : 'Delete Plan'}
                description="Permanently remove this meal plan"
                onPress={handleDelete}
                color={theme.colors.error}
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
    gap: 4,
  },
  planName: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
  },
  planDescription: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  planDate: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textTertiary,
    marginTop: 4,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textTertiary,
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
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
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
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  description: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
}));
