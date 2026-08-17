import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import {
  Pressable,
  PrimaryActivityIndicator,
  WhiteActivityIndicator,
} from '#components/atoms/themedComponents';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FormInput } from '#components/molecules/FormInput';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { useMealTemplate } from '#features/mealPlan/hooks/useMealTemplate';
import { type MealTemplateDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { Text } from '#components/atoms/Text';

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
  /** Server unreachable (offline / API down) — disables confirm (no replay path). */
  disabled?: boolean;
  /** When provided, shows an "Edit template" link that opens the builder. */
  onEdit?: (templateId: string) => void;
}

export const TemplatePreviewSheet: React.FC<TemplatePreviewSheetProps> = ({
  visible,
  template,
  onClose,
  onConfirm,
  confirmLoading,
  disabled = false,
  onEdit,
}) => {
  const { t } = useTranslation();
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
          <Text size="lg" weight="bold" style={styles.templateName}>
            {template.name}
          </Text>
          {!!template.description && (
            <Text size="sm" tone="secondary" style={styles.templateDescription}>
              {template.description}
            </Text>
          )}
          <View style={styles.metaRow}>
            <Text size="sm" tone="tertiary">
              {t('templatePreview.metaLine', {
                days: template.durationDays,
                servings: template.defaultServings,
              })}
              {template.home?.name ? ` · ${template.home.name}` : ''}
            </Text>
            <Text size="xs" weight="medium" tone="accent">
              {template.category.charAt(0) +
                template.category.slice(1).toLowerCase()}
            </Text>
          </View>
        </View>

        {/* Configuration form */}
        <View style={styles.configSection}>
          <Text size="base" weight="semibold" style={styles.sectionTitle}>
            {t('templatePreview.configuration')}
          </Text>
          <FormInput
            label={t('templatePreview.planNameLabel')}
            value={nameOverride}
            onChangeText={setNameOverride}
            placeholder={template.name}
          />
          <DatePickerField
            label={t('templatePreview.startDateLabel')}
            value={startDate}
            onChange={setStartDate}
            minimumDate={new Date()}
            required
          />
          <EditableCounter
            label={t('templatePreview.servingsLabel')}
            value={servings}
            onChangeText={setServings}
            min={1}
            step={1}
          />
        </View>

        {/* Day-by-day preview */}
        <View style={styles.previewSection}>
          <Text size="base" weight="semibold" style={styles.sectionTitle}>
            {t('templatePreview.preview')}
          </Text>
          {loading ? (
            <PrimaryActivityIndicator size="small" />
          ) : groupedByDay.length === 0 ? (
            <Text
              size="sm"
              tone="tertiary"
              align="center"
              style={styles.emptyPreview}
            >
              {t('templatePreview.emptyPreview')}
            </Text>
          ) : (
            groupedByDay.map(day => (
              <View key={day.dayOffset} style={styles.dayGroup}>
                <Text
                  size="sm"
                  weight="semibold"
                  tone="accent"
                  style={styles.dayLabel}
                >
                  {t('templatePreview.day', { day: day.dayOffset + 1 })}
                </Text>
                {day.items.map(item => (
                  <View key={item.id} style={styles.mealRow}>
                    <Text
                      size="xs"
                      weight="medium"
                      tone="tertiary"
                      style={styles.mealType}
                    >
                      {item.mealType.charAt(0) +
                        item.mealType.slice(1).toLowerCase()}
                    </Text>
                    <Text size="sm" style={styles.mealName} numberOfLines={1}>
                      {item.recipe?.name ??
                        item.customMealName ??
                        t('templatePreview.customMeal')}
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
          disabled={confirmLoading || disabled || !startDate}
          style={({ pressed }) => [
            styles.confirmButton,
            pressed && styles.buttonPressed,
            (confirmLoading || disabled || !startDate) && styles.buttonDisabled,
          ]}
        >
          {confirmLoading ? (
            <WhiteActivityIndicator size="small" />
          ) : (
            <>
              <Icon name="calendar-outline" size={20} tone="white" />
              <Text size="base" weight="semibold" style={styles.confirmText}>
                {t('templatePreview.createMealPlan')}
              </Text>
            </>
          )}
        </Pressable>

        {!!onEdit && !!template && (
          <Pressable
            onPress={() => onEdit(template.id)}
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Icon name="create-outline" size={18} tone="accent" />
            <Text
              size="base"
              weight="medium"
              tone="accent"
              style={styles.editText}
            >
              {t('templatePreview.editTemplate')}
            </Text>
          </Pressable>
        )}
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
    borderCurve: 'continuous',
  },
  templateName: {
    marginBottom: theme.spacing.xs,
  },
  templateDescription: {
    marginBottom: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configSection: {
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    marginBottom: theme.spacing.sm,
  },
  previewSection: {
    marginBottom: theme.spacing.lg,
  },
  emptyPreview: {
    paddingVertical: theme.spacing.md,
  },
  dayGroup: {
    marginBottom: theme.spacing.md,
  },
  dayLabel: {
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
    width: 70,
  },
  mealName: {
    flex: 1,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary,
  },
  confirmText: {
    color: theme.colors.white,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  editText: {
    marginLeft: theme.spacing.xs,
  },
  buttonPressed: {
    opacity: theme.opacity.pressed,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
}));
