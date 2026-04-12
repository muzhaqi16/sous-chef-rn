import React, { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FormInput } from '#components/molecules/FormInput';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { useMealTemplate } from '#hooks/mealPlan/useMealTemplate';
import type { MealTemplateDisplayFragment } from '#generated';

interface TemplatePreviewSheetProps {
  visible: boolean;
  template: MealTemplateDisplayFragment | null;
  onClose: () => void;
  onConfirm: (config: {
    templateId: string;
    startDate: string;
    name?: string;
    servings?: number;
  }) => void;
  confirmLoading: boolean;
}

export const TemplatePreviewSheet: React.FC<TemplatePreviewSheetProps> = ({
  visible,
  template,
  onClose,
  onConfirm,
  confirmLoading,
}) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  // Standard bottom-sheet boilerplate handled by useStandardBottomSheet.
  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    visible: visible && !!template,
    onDismiss: onClose,
    snapPoints: ['85%'],
  });

  const { groupedByDay, loading } = useMealTemplate(template?.id);

  const [nameOverride, setNameOverride] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [servings, setServings] = useState('');

  // Reset state when sheet opens (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevTemplate, setPrevTemplate] = useState(template);
  if (visible !== prevVisible || template !== prevTemplate) {
    setPrevVisible(visible);
    setPrevTemplate(template);
    if (visible && template) {
      setNameOverride('');
      setStartDate(new Date());
      setServings(template.defaultServings.toString());
    }
  }

  const handleConfirm = () => {
    if (!template || !startDate) return;
    const servingsNum = parseInt(servings);
    onConfirm({
      templateId: template.id,
      startDate: startDate.toISOString(),
      name: nameOverride.trim() || undefined,
      servings:
        !isNaN(servingsNum) && servingsNum > 0 ? servingsNum : undefined,
    });
  };

  if (!template) return null;

  return (
    <BottomSheetModal ref={bottomSheetRef} {...modalProps}>
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Template header */}
        <View style={styles.templateHeader}>
          <Text style={styles.templateName}>{template.name}</Text>
          {!!template.description && (
            <Text style={styles.templateDescription}>
              {template.description}
            </Text>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {template.durationDays} days · {template.defaultServings} servings
              {template.home?.name ? ` · ${template.home.name}` : ''}
            </Text>
            <Text style={styles.categoryText}>
              {template.category.charAt(0) +
                template.category.slice(1).toLowerCase()}
            </Text>
          </View>
        </View>

        {/* Configuration form */}
        <View style={styles.configSection}>
          <Text style={styles.sectionTitle}>Configuration</Text>
          <FormInput
            label="Plan Name (optional)"
            value={nameOverride}
            onChangeText={setNameOverride}
            placeholder={template.name}
          />
          <DatePickerField
            label="Start Date"
            value={startDate}
            onChange={setStartDate}
            minimumDate={new Date()}
            required
          />
          <EditableCounter
            label="Servings"
            value={servings}
            onChangeText={setServings}
            min={1}
            step={1}
          />
        </View>

        {/* Day-by-day preview */}
        <View style={styles.previewSection}>
          <Text style={styles.sectionTitle}>Preview</Text>
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : groupedByDay.length === 0 ? (
            <Text style={styles.emptyPreview}>No meals in this template</Text>
          ) : (
            groupedByDay.map(day => (
              <View key={day.dayOffset} style={styles.dayGroup}>
                <Text style={styles.dayLabel}>Day {day.dayOffset + 1}</Text>
                {day.items.map(item => (
                  <View key={item.id} style={styles.mealRow}>
                    <Text style={styles.mealType}>
                      {item.mealType.charAt(0) +
                        item.mealType.slice(1).toLowerCase()}
                    </Text>
                    <Text style={styles.mealName} numberOfLines={1}>
                      {item.recipe?.name ?? item.customMealName ?? 'Custom'}
                    </Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>

        {/* Confirm button */}
        <Pressable
          onPress={handleConfirm}
          disabled={confirmLoading || !startDate}
          style={({ pressed }) => [
            styles.confirmButton,
            pressed && styles.buttonPressed,
            (confirmLoading || !startDate) && styles.buttonDisabled,
          ]}
        >
          {confirmLoading ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <>
              <Icon
                name="calendar-outline"
                size={20}
                color={theme.colors.white}
              />
              <Text style={styles.confirmText}>Create Meal Plan</Text>
            </>
          )}
        </Pressable>
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
  },
  templateHeader: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
  },
  templateName: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  templateDescription: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textTertiary,
  },
  categoryText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.primary,
  },
  configSection: {
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  previewSection: {
    marginBottom: theme.spacing.lg,
  },
  emptyPreview: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
  dayGroup: {
    marginBottom: theme.spacing.md,
  },
  dayLabel: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    paddingLeft: theme.spacing.sm,
  },
  mealType: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textTertiary,
    width: 70,
  },
  mealName: {
    flex: 1,
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primary,
  },
  confirmText: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.white,
  },
  buttonPressed: {
    opacity: theme.opacity.pressed,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
}));
