import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import {
  MEAL_TYPE_LABEL_KEYS,
  TEMPLATE_CATEGORY_LABEL_KEYS,
} from '#features/mealPlan/utils/mealPlanEnumLabels';
import {
  Pressable,
  PrimaryActivityIndicator,
  OnPrimaryActivityIndicator,
} from '#components/atoms/themedComponents';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FormInput } from '#components/atoms/FormInput';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { useMealTemplate } from '#features/mealPlan/hooks/useMealTemplate';
import type { MealTemplateDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { Text } from '#components/atoms/Text';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { alertService } from '#/services/alertService';
import { mealPlanTestIDs } from '#features/mealPlan/testIDs';
import { DataStateView } from '#components/organisms/DataStateView';
import { useDataState } from '#hooks/data/useDataState';
import { toMealDateTime } from '#/utils/dateUtils';

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
  /** Each management action renders only when its handler is passed. */
  onEdit?: (templateId: string) => void;
  /** Called after the user confirms the deletion. */
  onDelete?: (templateId: string) => void;
  onDuplicate?: (templateId: string, newName: string) => void;
  duplicating?: boolean;
}

export const TemplatePreviewSheet: React.FC<TemplatePreviewSheetProps> = ({
  visible,
  template,
  onClose,
  onConfirm,
  confirmLoading,
  disabled = false,
  onEdit,
  onDelete,
  onDuplicate,
  duplicating = false,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Standard bottom-sheet boilerplate handled by useStandardBottomSheet.
  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    visible: visible && !!template,
    onDismiss: onClose,
    snapPoints: ['85%'],
  });

  const { groupedByDay, loading, error, hasResult, refetch } = useMealTemplate(
    template?.id,
  );
  const previewState = useDataState({
    loading,
    error,
    hasResult,
    isEmpty: groupedByDay.length === 0,
    skipped: !template,
  });
  // The copy is derived from the loaded items.
  const itemsLoaded = previewState === 'ready' || previewState === 'empty';

  const [nameOverride, setNameOverride] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [servings, setServings] = useState('');
  // Null while the duplicate form is closed.
  const [duplicateName, setDuplicateName] = useState<string | null>(null);

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
      setDuplicateName(null);
    }
  }

  const handleConfirm = () => {
    if (!template || !startDate) return;
    const servingsNum = parseInt(servings);
    onConfirm({
      templateId: template.id,
      startDate: toMealDateTime(startDate),
      name: nameOverride.trim() || undefined,
      servings:
        !isNaN(servingsNum) && servingsNum > 0 ? servingsNum : undefined,
    });
  };

  if (!template) return null;

  const handleDelete = (confirmDelete: (templateId: string) => void) => {
    alertService.alert(
      t('templatePreview.deleteTemplate'),
      t('labels.areYouSureYouWantToDeleteThisCannotBeUndone', {
        name: template.name,
      }),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.delete'),
          style: 'destructive',
          onPress: () => confirmDelete(template.id),
        },
      ],
    );
  };

  const trimmedDuplicateName = duplicateName?.trim() ?? '';

  return (
    <BottomSheetModal ref={bottomSheetRef} {...modalProps}>
      {/* Not `BottomSheetScrollView`: this sheet holds inputs, and only the
          form scrollable supplies gorhom's input context — without it they
          resolve to a plain RN TextInput and the sheet is blind to the
          keyboard covering the field being typed into. Fixed snap points, so
          a keyboard-aware scrollable is safe here. */}
      <BottomSheetFormScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Template header */}
        <View style={styles.templateHeader}>
          <Text role="heading" style={styles.templateName}>
            {template.name}
          </Text>
          {!!template.description && (
            <Text
              role="caption"
              tone="secondary"
              style={styles.templateDescription}
            >
              {template.description}
            </Text>
          )}
          <View style={styles.metaRow}>
            <Text role="caption" tone="tertiary">
              {t('templatePreview.metaLine', {
                days: template.durationDays,
                servings: template.defaultServings,
              })}
              {template.home?.name ? ` · ${template.home.name}` : ''}
            </Text>
            <Text role="label" tone="primary">
              {t(TEMPLATE_CATEGORY_LABEL_KEYS[template.category])}
            </Text>
          </View>
        </View>

        {/* Configuration form */}
        <View style={styles.configSection}>
          <SectionHeader variant="title" style={styles.sectionTitle}>
            {t('templatePreview.configuration')}
          </SectionHeader>
          <FormInput
            label={t('templatePreview.planNameLabel')}
            value={nameOverride}
            onChangeText={setNameOverride}
            placeholder={template.name}
          />
          <DatePickerField
            label={t('labels.startDate')}
            value={startDate}
            onChange={setStartDate}
            minimumDate={new Date()}
            required
          />
          <EditableCounter
            label={t('labels.servings')}
            value={servings}
            onChangeText={setServings}
            min={1}
            step={1}
          />
        </View>

        {/* Day-by-day preview */}
        <View style={styles.previewSection}>
          <SectionHeader variant="title" style={styles.sectionTitle}>
            {t('templatePreview.preview')}
          </SectionHeader>
          {previewState === 'loading' ? (
            <PrimaryActivityIndicator size="small" />
          ) : previewState === 'error' || previewState === 'offline' ? (
            <DataStateView state={previewState} onRetry={refetch} />
          ) : previewState === 'empty' ? (
            <Text
              role="caption"
              tone="tertiary"
              align="center"
              style={styles.emptyPreview}
            >
              {t('templatePreview.emptyPreview')}
            </Text>
          ) : (
            groupedByDay.map(day => (
              <View key={day.dayOffset} style={styles.dayGroup}>
                <Text role="label" tone="primary" style={styles.dayLabel}>
                  {t('templatePreview.day', { day: day.dayOffset + 1 })}
                </Text>
                {day.items.map(item => (
                  <View key={item.id} style={styles.mealRow}>
                    <Text role="label" tone="tertiary" style={styles.mealType}>
                      {t(MEAL_TYPE_LABEL_KEYS[item.mealType])}
                    </Text>
                    <Text
                      role="caption"
                      style={styles.mealName}
                      numberOfLines={1}
                    >
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
            <OnPrimaryActivityIndicator size="small" />
          ) : (
            <>
              <Icon name="calendar-outline" size={20} tone="onPrimary" />
              <Text role="bodyStrong" style={styles.confirmText}>
                {t('labels.createMealPlan')}
              </Text>
            </>
          )}
        </Pressable>

        {!!onDuplicate && duplicateName !== null && (
          <View style={styles.duplicateForm}>
            <FormInput
              label={t('templatePreview.duplicateNameLabel')}
              value={duplicateName}
              onChangeText={setDuplicateName}
              testID={mealPlanTestIDs.templateDuplicateNameInput}
            />
            <View style={styles.duplicateActions}>
              <Pressable
                onPress={() => setDuplicateName(null)}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text role="bodyStrong" tone="secondary">
                  {t('labels.cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onDuplicate(template.id, trimmedDuplicateName)}
                disabled={duplicating || !trimmedDuplicateName}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                  (duplicating || !trimmedDuplicateName) &&
                    styles.buttonDisabled,
                ]}
                testID={mealPlanTestIDs.templateDuplicateConfirmButton}
              >
                <Text role="bodyStrong" tone="primary">
                  {duplicating
                    ? t('duplicatePlan.duplicating')
                    : t('duplicatePlan.duplicate')}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {!!onEdit && (
          <Pressable
            onPress={() => onEdit(template.id)}
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.buttonPressed,
            ]}
            testID={mealPlanTestIDs.templatePreviewEditButton}
          >
            <Icon name="create-outline" size={18} tone="primary" />
            <Text role="bodyStrong" tone="primary" style={styles.editText}>
              {t('labels.editTemplate')}
            </Text>
          </Pressable>
        )}

        {!!onDuplicate && duplicateName === null && (
          <Pressable
            onPress={() =>
              setDuplicateName(t('labels.copyOfName', { name: template.name }))
            }
            disabled={!itemsLoaded}
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.buttonPressed,
              !itemsLoaded && styles.buttonDisabled,
            ]}
            testID={mealPlanTestIDs.templatePreviewDuplicateButton}
          >
            <Icon name="copy-outline" size={18} tone="primary" />
            <Text role="bodyStrong" tone="primary" style={styles.editText}>
              {t('templatePreview.duplicateTemplate')}
            </Text>
          </Pressable>
        )}

        {!!onDelete && (
          <Pressable
            onPress={() => handleDelete(onDelete)}
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.buttonPressed,
            ]}
            testID={mealPlanTestIDs.templatePreviewDeleteButton}
          >
            <Icon name="trash-outline" size={18} tone="error" />
            <Text role="bodyStrong" tone="danger" style={styles.editText}>
              {t('templatePreview.deleteTemplate')}
            </Text>
          </Pressable>
        )}
      </BottomSheetFormScrollView>
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
    color: theme.colors.onPrimary,
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
  duplicateForm: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  duplicateActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  secondaryButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  buttonPressed: {
    opacity: theme.opacity.pressed,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
}));
