import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { BaseSwitch } from '#components/base/BaseSwitch';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { FormInput } from '#components/molecules/FormInput';
import { useGetShoppingListsLiteQuery } from '#generated';
import { Icon } from '#utils/iconUtils';

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
}

export const GenerateShoppingListSheet: React.FC<GenerateShoppingListSheetProps> = ({
  visible,
  onClose,
  onGenerate,
  loading,
  homeName,
}) => {
  const { theme } = useUnistyles();
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['65%'],
    keyboardBehavior: 'interactive',
  });

  const [checkPantry, setCheckPantry] = useState(true);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [customName, setCustomName] = useState('');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const { data: listsData } = useGetShoppingListsLiteQuery({
    variables: { first: 20 },
    skip: !visible,
  });

  const shoppingLists = listsData?.shoppingLists?.edges?.map(e => e.node) ?? [];

  useEffect(() => {
    if (visible) {
      setCheckPantry(true);
      setMode('new');
      setCustomName('');
      setSelectedListId(null);
    }
  }, [visible]);

  const handleGenerate = useCallback(() => {
    onGenerate({
      checkPantry,
      name: mode === 'new' && customName.trim() ? customName.trim() : undefined,
      shoppingListId: mode === 'existing' ? (selectedListId ?? undefined) : undefined,
    });
  }, [checkPantry, mode, customName, selectedListId, onGenerate]);

  const canGenerate = mode === 'new' || (mode === 'existing' && selectedListId);

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        <BottomSheetHeader
          title="Generate Shopping List"
          onCancel={onClose}
          onConfirm={handleGenerate}
          confirmLabel={loading ? 'Generating...' : 'Generate'}
          confirmDisabled={loading || !canGenerate}
          confirmColor="primary"
        />

        {/* Home sharing info */}
        {!!homeName && (
          <View style={styles.infoNote}>
            <Icon name="information-circle-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.infoNoteText}>
              The shopping list will be shared with {homeName}
            </Text>
          </View>
        )}

        {/* Check pantry toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Check pantry availability</Text>
            <Text style={styles.toggleDescription}>
              Deduct items you already have in your pantry
            </Text>
          </View>
          <BaseSwitch
            value={checkPantry}
            onValueChange={setCheckPantry}
          />
        </View>

        {/* Mode selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Destination</Text>
          <View style={styles.modeRow}>
            <Pressable
              onPress={() => setMode('new')}
              style={[styles.modeOption, mode === 'new' && styles.modeOptionActive]}
            >
              <Icon
                name="add-circle-outline"
                size={20}
                color={mode === 'new' ? theme.colors.white : theme.colors.textSecondary}
              />
              <Text style={[styles.modeText, mode === 'new' && styles.modeTextActive]}>
                New List
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('existing')}
              style={[styles.modeOption, mode === 'existing' && styles.modeOptionActive]}
            >
              <Icon
                name="list-outline"
                size={20}
                color={mode === 'existing' ? theme.colors.white : theme.colors.textSecondary}
              />
              <Text style={[styles.modeText, mode === 'existing' && styles.modeTextActive]}>
                Existing List
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Custom name for new list */}
        {mode === 'new' && (
          <FormInput
            label="List Name (optional)"
            value={customName}
            onChangeText={setCustomName}
            placeholder="Defaults to meal plan name"
          />
        )}

        {/* Existing list picker */}
        {mode === 'existing' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Select a list</Text>
            {shoppingLists.length === 0 ? (
              <Text style={styles.emptyText}>No shopping lists found</Text>
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
                    name={selectedListId === list.id ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selectedListId === list.id ? theme.colors.primary : theme.colors.textTertiary}
                  />
                  <View style={styles.listItemContent}>
                    <Text style={styles.listItemName}>{list.name}</Text>
                    <Text style={styles.listItemMeta}>
                      {list.totalItems} items
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {!!loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Generating shopping list...</Text>
          </View>
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
    fontSize: theme.fonts.size.sm,
    color: theme.colors.primary,
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
  toggleLabel: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  toggleDescription: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
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
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
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
  listItemName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  listItemMeta: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  emptyText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  loadingText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
}));
