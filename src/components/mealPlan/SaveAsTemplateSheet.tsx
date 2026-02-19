import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs } from '#hooks/useSharedBottomSheetConfigs';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { FormInput } from '#components/molecules/FormInput';
import { FormTextArea } from '#components/molecules/FormTextArea';
import { TemplateCategory } from '#generated';

const CATEGORY_OPTIONS: { key: TemplateCategory; label: string }[] = [
  { key: TemplateCategory.Weekly, label: 'Weekly' },
  { key: TemplateCategory.Monthly, label: 'Monthly' },
  { key: TemplateCategory.Breakfast, label: 'Breakfast' },
  { key: TemplateCategory.Lunch, label: 'Lunch' },
  { key: TemplateCategory.Dinner, label: 'Dinner' },
  { key: TemplateCategory.Holiday, label: 'Holiday' },
  { key: TemplateCategory.SpecialDiet, label: 'Special Diet' },
  { key: TemplateCategory.Custom, label: 'Custom' },
];

interface SaveAsTemplateSheetProps {
  visible: boolean;
  mealPlanId: string | null;
  mealPlanName?: string;
  onClose: () => void;
  onSave: (input: {
    mealPlanId: string;
    name: string;
    description?: string;
    category?: TemplateCategory;
    tags?: string[];
  }) => void;
  saving: boolean;
}

export const SaveAsTemplateSheet: React.FC<SaveAsTemplateSheetProps> = ({
  visible,
  mealPlanId,
  mealPlanName,
  onClose,
  onSave,
  saving,
}) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TemplateCategory>(TemplateCategory.Weekly);
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
      setName(mealPlanName ? `${mealPlanName} Template` : '');
      setDescription('');
      setCategory(TemplateCategory.Weekly);
      setTagsInput('');
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, mealPlanName]);

  const handleSave = useCallback(() => {
    if (!mealPlanId || !name.trim()) return;
    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    onSave({
      mealPlanId,
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      tags: tags.length > 0 ? tags : undefined,
    });
  }, [mealPlanId, name, description, category, tagsInput, onSave]);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['70%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={props => (
        <GlobalBottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
          onClose={() => bottomSheetRef.current?.dismiss()}
        />
      )}
    >
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <BottomSheetHeader
          title="Save as Template"
          onCancel={onClose}
          onConfirm={handleSave}
          confirmLabel={saving ? 'Saving...' : 'Save'}
          confirmDisabled={saving || !name.trim()}
          confirmColor="primary"
        />

        <FormInput
          label="Template Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g., My Weekly Dinner Plan"
          required
        />

        <FormTextArea
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What's special about this template?"
        />

        {/* Category selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {CATEGORY_OPTIONS.map(cat => {
              const isActive = category === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => setCategory(cat.key)}
                  style={[styles.chip, isActive && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, isActive && styles.chipTextActive]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <FormInput
          label="Tags (comma-separated)"
          value={tagsInput}
          onChangeText={setTagsInput}
          placeholder="e.g., healthy, quick, budget"
        />
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
    gap: theme.spacing.md,
  },
  section: {
    gap: theme.spacing.sm,
  },
  label: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
  },
  chipRow: {
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  chipTextActive: {
    color: theme.colors.white,
    fontWeight: theme.fonts.weight.medium,
  },
}));
