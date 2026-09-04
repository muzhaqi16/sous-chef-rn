import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import {
  Pressable,
  PrimaryActivityIndicator,
} from '#components/atoms/themedComponents';
import { Sheet } from '#components/templates/Sheet';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { FormInput } from '#components/atoms/FormInput';
import { useShoppingListsForMealPlan } from '#features/mealPlan/hooks/useShoppingListsForMealPlan';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

interface GenerateShoppingListSheetProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (options: {
    checkPantry?: boolean;
    name?: string;
    shoppingListId?: string;
  }) => void;
  loading: boolean;
  homeName?: string | null;
  /** Server unreachable (offline / API down) — disables confirm (no replay path). */
  disabled?: boolean;
}

export const GenerateShoppingListSheet: React.FC<
  GenerateShoppingListSheetProps
> = ({ visible, onClose, onGenerate, loading, homeName, disabled = false }) => {
  const { t } = useTranslation();

  const [checkPantry, setCheckPantry] = useState(true);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [customName, setCustomName] = useState('');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // Reset state when sheet opens (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setCheckPantry(true);
      setMode('new');
      setCustomName('');
      setSelectedListId(null);
    }
  }

  const { shoppingLists } = useShoppingListsForMealPlan(!visible);

  const handleGenerate = () => {
    onGenerate({
      checkPantry,
      name: mode === 'new' && customName.trim() ? customName.trim() : undefined,
      shoppingListId:
        mode === 'existing' ? selectedListId ?? undefined : undefined,
    });
  };

  const canGenerate = mode === 'new' || (mode === 'existing' && selectedListId);

  return (
    <Sheet
      visible={visible}
      onDismiss={onClose}
      snapPoints={['65%']}
      mode="form"
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
    >
      {/* No title; the "Generate" action already names the intent. */}
      <BottomSheetHeader
        onCancel={onClose}
        onConfirm={handleGenerate}
        confirmLabel={
          loading
            ? t('generateShoppingList.generating')
            : t('generateShoppingList.generate')
        }
        confirmDisabled={loading || disabled || !canGenerate}
        confirmColor="primary"
      />

      {/* Home sharing info */}
      {!!homeName && (
        <View style={styles.infoNote}>
          <Icon name="information-circle-outline" size={18} tone="primary" />
          <Text role="caption" tone="accent" style={styles.infoNoteText}>
            {t('generateShoppingList.sharedWithHome', { name: homeName })}
          </Text>
        </View>
      )}

      {/* Check pantry toggle */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text role="bodyStrong">{t('generateShoppingList.checkPantry')}</Text>
          <Text
            role="caption"
            tone="secondary"
            style={styles.toggleDescription}
          >
            {t('generateShoppingList.checkPantryDesc')}
          </Text>
        </View>
        <BaseSwitch
          accessibilityLabel={t('generateShoppingList.checkPantry')}
          value={checkPantry}
          onValueChange={setCheckPantry}
        />
      </View>

      {/* Mode selector */}
      <View style={styles.section}>
        <Text role="label" tone="secondary">
          {t('generateShoppingList.destination')}
        </Text>
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setMode('new')}
            style={[
              styles.modeOption,
              mode === 'new' && styles.modeOptionActive,
            ]}
          >
            <Icon
              name="add-circle-outline"
              size={20}
              tone={mode === 'new' ? 'onPrimary' : 'textSecondary'}
            />
            <Text
              role="label"
              style={[styles.modeText, mode === 'new' && styles.modeTextActive]}
            >
              {t('generateShoppingList.newList')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('existing')}
            style={[
              styles.modeOption,
              mode === 'existing' && styles.modeOptionActive,
            ]}
          >
            <Icon
              name="list-outline"
              size={20}
              tone={mode === 'existing' ? 'onPrimary' : 'textSecondary'}
            />
            <Text
              role="label"
              style={[
                styles.modeText,
                mode === 'existing' && styles.modeTextActive,
              ]}
            >
              {t('generateShoppingList.existingList')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Custom name for new list */}
      {mode === 'new' && (
        <FormInput
          label={t('generateShoppingList.listNameLabel')}
          value={customName}
          onChangeText={setCustomName}
          placeholder={t('generateShoppingList.listNamePlaceholder')}
        />
      )}

      {/* Existing list picker */}
      {mode === 'existing' && (
        <View style={styles.section}>
          <Text role="label" tone="secondary">
            {t('generateShoppingList.selectListLabel')}
          </Text>
          {shoppingLists.length === 0 ? (
            <Text
              role="caption"
              tone="tertiary"
              align="center"
              style={styles.emptyMessage}
            >
              {t('generateShoppingList.noLists')}
            </Text>
          ) : (
            shoppingLists.map(list => (
              <Pressable
                key={list.id}
                onPress={() => setSelectedListId(list.id)}
                style={[
                  styles.listItem,
                  selectedListId === list.id && styles.listItemSelected,
                ]}
              >
                <Icon
                  name={
                    selectedListId === list.id
                      ? 'radio-button-on'
                      : 'radio-button-off'
                  }
                  size={20}
                  tone={selectedListId === list.id ? 'primary' : 'textTertiary'}
                />
                <View style={styles.listItemContent}>
                  <Text role="bodyStrong">{list.name}</Text>
                  <Text role="caption" tone="secondary">
                    {t('generateShoppingList.itemsCount', {
                      count: list.totalItems,
                    })}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      )}

      {!!loading && (
        <View style={styles.spinnerRow}>
          <PrimaryActivityIndicator size="small" />
          <Text role="caption" tone="secondary">
            {t('generateShoppingList.generatingMessage')}
          </Text>
        </View>
      )}
    </Sheet>
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
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  infoNoteText: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  toggleInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  toggleDescription: {
    marginTop: 2,
  },
  section: {
    gap: theme.spacing.sm,
  },
  modeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
  },
  modeOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  modeText: {
    color: theme.colors.textSecondary,
  },
  modeTextActive: {
    color: theme.colors.onPrimary,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    gap: theme.spacing.sm,
  },
  listItemSelected: {
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.primary,
  },
  listItemContent: {
    flex: 1,
  },
  emptyMessage: {
    paddingVertical: theme.spacing.md,
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
}));
