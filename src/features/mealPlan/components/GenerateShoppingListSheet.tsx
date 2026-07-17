import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  PrimaryActivityIndicator,
} from '#components/atoms/themedComponents';
import { BottomSheetLayout } from '#components/atoms/BottomSheetLayout';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/base/BaseSwitch';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { FormInput } from '#components/molecules/FormInput';
import { useQuery } from '@apollo/client/react';
import { GetShoppingListsLiteDocument } from './GenerateShoppingListSheet.generated';
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

  const { data: listsData } = useQuery(GetShoppingListsLiteDocument, {
    variables: { first: 20 },
    skip: !visible,
  });

  const shoppingLists = listsData?.shoppingLists?.edges?.map(e => e.node) ?? [];

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
    <BottomSheetLayout
      visible={visible}
      onDismiss={onClose}
      snapPoints={['65%']}
      keyboardAware
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
          <Text size="sm" tone="accent" style={styles.infoNoteText}>
            {t('generateShoppingList.sharedWithHome', { name: homeName })}
          </Text>
        </View>
      )}

      {/* Check pantry toggle */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text size="md" weight="medium">
            {t('generateShoppingList.checkPantry')}
          </Text>
          <Text size="sm" tone="secondary" style={styles.toggleDescription}>
            {t('generateShoppingList.checkPantryDesc')}
          </Text>
        </View>
        <BaseSwitch value={checkPantry} onValueChange={setCheckPantry} />
      </View>

      {/* Mode selector */}
      <View style={styles.section}>
        <Text size="sm" weight="medium" tone="secondary">
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
              tone={mode === 'new' ? 'white' : 'textSecondary'}
            />
            <Text
              size="sm"
              weight="medium"
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
              tone={mode === 'existing' ? 'white' : 'textSecondary'}
            />
            <Text
              size="sm"
              weight="medium"
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
          <Text size="sm" weight="medium" tone="secondary">
            {t('generateShoppingList.selectListLabel')}
          </Text>
          {shoppingLists.length === 0 ? (
            <Text
              size="sm"
              tone="tertiary"
              align="center"
              style={styles.emptyText}
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
                  <Text size="md" weight="medium">
                    {list.name}
                  </Text>
                  <Text size="sm" tone="secondary">
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
        <View style={styles.loadingContainer}>
          <PrimaryActivityIndicator size="small" />
          <Text size="sm" tone="secondary">
            {t('generateShoppingList.generatingMessage')}
          </Text>
        </View>
      )}
    </BottomSheetLayout>
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
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
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
    color: theme.colors.white,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    gap: theme.spacing.sm,
  },
  listItemSelected: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  listItemContent: {
    flex: 1,
  },
  emptyText: {
    paddingVertical: theme.spacing.md,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
}));
