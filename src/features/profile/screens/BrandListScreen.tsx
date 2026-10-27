import React, { useState } from 'react';
import { View } from 'react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { destructiveConfirm } from '#/services/destructiveConfirm';
import { SubScreen } from '#components/templates/SubScreen';
import { RowCard } from '#components/atoms/RowCard';
import { IconButton } from '#components/atoms/IconButton';
import { Text } from '#components/atoms/Text';
import { ListItem } from '#components/molecules/ListItem';
import { SettingSwitch } from '#components/molecules/SettingSwitch';
import { TextEditBottomSheet } from '#components/organisms/TextEditBottomSheet/TextEditBottomSheet';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useBrandLists } from '#features/profile/hooks/useBrandLists';
import { AddBrandSheet } from '#features/profile/components/AddBrandSheet';
import { profileTestIDs } from '#features/profile/testIDs';
import { brandListNameSchema } from './brandListName';

type BrandListScreenProps = StaticScreenProps<{ listId: string }>;

/** One of the user's brand lists: its switch, its brands, and its name. */
export const BrandListScreen: React.FC<BrandListScreenProps> = ({ route }) => {
  const { listId } = route.params;
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
  const { lists, setEnabled, renameList, deleteList, addBrand, removeBrand } =
    useBrandLists();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const list = lists.find(candidate => candidate.id === listId);

  const confirmDelete = () => {
    if (!list) return;
    alertService.alert(
      t('brandLists.deleteTitle', { name: list.name }),
      t('brandLists.deleteBody'),
      destructiveConfirm(t('brandLists.deleteList'), () => {
        goBack();
        void deleteList(list.id);
      }),
    );
  };

  return (
    <SubScreen
      title={list?.name ?? t('brandLists.title')}
      testID={profileTestIDs.brandListScreen}
      actions={
        list
          ? [
              {
                icon: 'add',
                accessibilityLabel: t('brandLists.addBrand'),
                onPress: () => setAdding(true),
                testID: profileTestIDs.brandListAddBrand,
              },
            ]
          : []
      }
    >
      {!!list && (
        <View style={styles.content}>
          <SettingSwitch
            title={t('brandLists.applies')}
            value={list.enabled}
            onValueChange={enabled => {
              void setEnabled(list.id, enabled);
            }}
            testID={profileTestIDs.brandListSwitch(list.id)}
          />
          {list.brands.length === 0 ? (
            <Text role="body" tone="secondary">
              {t('brandLists.noBrands')}
            </Text>
          ) : (
            <View>
              {list.brands.map(brand => (
                <RowCard
                  key={brand.entryId}
                  testID={profileTestIDs.brandEntryRow(brand.entryId)}
                >
                  <ListItem
                    title={brand.name}
                    subtitle={brand.reason ?? undefined}
                    rightElement={
                      <IconButton
                        name="close-circle-outline"
                        tone="iconSecondary"
                        onPress={() => {
                          void removeBrand(list.id, brand.entryId);
                        }}
                        accessibilityLabel={t('a11y.removeNamed', {
                          name: brand.name,
                        })}
                      />
                    }
                  />
                </RowCard>
              ))}
            </View>
          )}
          <View>
            <RowCard testID={profileTestIDs.brandListRename}>
              <ListItem
                title={t('brandLists.rename')}
                onPress={() => setRenaming(true)}
              />
            </RowCard>
            <RowCard testID={profileTestIDs.brandListDelete}>
              <ListItem
                title={t('brandLists.deleteList')}
                onPress={confirmDelete}
              />
            </RowCard>
          </View>
          <AddBrandSheet
            visible={adding}
            listName={list.name}
            heldBrandIds={new Set(list.brands.map(brand => brand.brandId))}
            onDismiss={() => setAdding(false)}
            onPick={(brand, reason) => addBrand(list.id, brand, reason)}
          />
          <TextEditBottomSheet
            visible={renaming}
            title={t('brandLists.rename')}
            label={t('brandLists.nameLabel')}
            initialValue={list.name}
            fieldKey="name"
            validationSchema={brandListNameSchema}
            maxLength={100}
            onClose={() => setRenaming(false)}
            onSave={name => {
              setRenaming(false);
              void renameList(list.id, name.trim());
            }}
          />
        </View>
      )}
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
}));
