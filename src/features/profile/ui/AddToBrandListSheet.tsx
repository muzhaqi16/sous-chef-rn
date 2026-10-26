import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { RowCard } from '#components/atoms/RowCard';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { Button } from '#components/molecules/Button';
import { ListItem } from '#components/molecules/ListItem';
import { Sheet } from '#components/templates/Sheet';
import type { BrandListView } from '#features/profile/hooks/useBrandLists';
import { profileTestIDs } from '#features/profile/testIDs';
import { commonStyles } from '#/styles/commonStyles';

interface AddToBrandListSheetProps {
  visible: boolean;
  brand: { id: string; name: string };
  lists: BrandListView[];
  onDismiss: () => void;
  /** Resolves whether the brand was added; the sheet closes only when it was. */
  onPick: (listId: string, reason: string | null) => Promise<boolean>;
  /** Opens the user's lists, for a user who has none yet. */
  onMakeList: () => void;
}

/**
 * Puts a brand on one of the user's lists, with an optional note: the scan
 * card's "add to a list".
 */
export const AddToBrandListSheet: React.FC<AddToBrandListSheetProps> = ({
  visible,
  brand,
  lists,
  onDismiss,
  onPick,
  onMakeList,
}) => {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // A closed sheet forgets its note, adjusted while rendering.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) setNote('');
  }

  const handlePick = async (listId: string) => {
    if (saving) return;
    setSaving(true);
    const added = await onPick(listId, note.trim() || null);
    setSaving(false);
    if (added) onDismiss();
  };

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={['60%']}
      title={t('brandLists.pickList')}
      contentContainerStyle={commonStyles.bottomSheetContent}
    >
      <View testID={profileTestIDs.addToBrandListSheet}>
        {lists.length === 0 ? (
          <View style={styles.empty}>
            <Text role="body" tone="secondary" align="center">
              {t('brandLists.emptyTitle')}
            </Text>
            <Button variant="outline" onPress={onMakeList}>
              {t('brandLists.newList')}
            </Button>
          </View>
        ) : (
          <>
            <BaseInput
              label={t('brandLists.noteLabel')}
              defaultValue={note}
              onChangeText={setNote}
              placeholder={t('brandLists.notePlaceholder')}
              maxLength={500}
            />
            {lists.map(list => {
              const held = list.brands.some(
                entry => entry.brandId === brand.id,
              );
              return (
                <RowCard
                  key={list.id}
                  testID={profileTestIDs.brandListChoice(list.id)}
                >
                  <ListItem
                    title={list.name}
                    subtitle={held ? t('brandLists.alreadyOn') : undefined}
                    onPress={
                      held
                        ? undefined
                        : () => {
                            void handlePick(list.id);
                          }
                    }
                  />
                </RowCard>
              );
            })}
          </>
        )}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  empty: {
    gap: theme.spacing.md,
  },
}));
