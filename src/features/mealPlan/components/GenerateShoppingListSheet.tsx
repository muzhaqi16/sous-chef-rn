import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { BaseSwitch } from '#components/base/BaseSwitch';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { FormInput } from '#components/molecules/FormInput';
import { useQuery } from '@apollo/client/react';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
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
}

export const GenerateShoppingListSheet: React.FC<
  GenerateShoppingListSheetProps
> = ({ visible, onClose, onGenerate, loading, homeName }) => {
  const { theme } = useUnistyles();
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['65%'],
    keyboardAware: true,
  });

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
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetFormScrollView
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
            <Icon
              name="information-circle-outline"
              size={18}
              color={theme.colors.primary}
            />
            <Text size="sm" tone="accent" style={styles.infoNoteText}>
              The shopping list will be shared with {homeName}
            </Text>
          </View>
        )}

        {/* Check pantry toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text size="md" weight="medium">
              Check pantry availability
            </Text>
            <Text size="sm" tone="secondary" style={styles.toggleDescription}>
              Deduct items you already have in your pantry
            </Text>
          </View>
          <BaseSwitch value={checkPantry} onValueChange={setCheckPantry} />
        </View>

        {/* Mode selector */}
        <View style={styles.section}>
          <Text size="sm" weight="medium" tone="secondary">
            Destination
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
                color={
                  mode === 'new'
                    ? theme.colors.white
                    : theme.colors.textSecondary
                }
              />
              <Text
                size="sm"
                weight="medium"
                style={[
                  styles.modeText,
                  mode === 'new' && styles.modeTextActive,
                ]}
              >
                New List
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
                color={
                  mode === 'existing'
                    ? theme.colors.white
                    : theme.colors.textSecondary
                }
              />
              <Text
                size="sm"
                weight="medium"
                style={[
                  styles.modeText,
                  mode === 'existing' && styles.modeTextActive,
                ]}
              >
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
            <Text size="sm" weight="medium" tone="secondary">
              Select a list
            </Text>
            {shoppingLists.length === 0 ? (
              <Text
                size="sm"
                tone="tertiary"
                align="center"
                style={styles.emptyText}
              >
                No shopping lists found
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
                    color={
                      selectedListId === list.id
                        ? theme.colors.primary
                        : theme.colors.textTertiary
                    }
                  />
                  <View style={styles.listItemContent}>
                    <Text size="md" weight="medium">
                      {list.name}
                    </Text>
                    <Text size="sm" tone="secondary">
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
            <Text size="sm" tone="secondary">
              Generating shopping list...
            </Text>
          </View>
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
