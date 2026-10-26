import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { SubScreen } from '#components/templates/SubScreen';
import { RowCard } from '#components/atoms/RowCard';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { Text } from '#components/atoms/Text';
import { ListItem } from '#components/molecules/ListItem';
import { EmptyState } from '#components/molecules/EmptyState';
import { TextEditBottomSheet } from '#components/organisms/TextEditBottomSheet/TextEditBottomSheet';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useBrandLists } from '#features/profile/hooks/useBrandLists';
import { profileTestIDs } from '#features/profile/testIDs';
import { brandListNameSchema } from './brandListName';

/**
 * The user's own brand lists, each with its switch: a list applies to their
 * scans only while it is on.
 */
export const BrandListsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { toBrandList } = useAppNavigation();
  const { lists, loaded, createList, setEnabled } = useBrandLists();
  const [naming, setNaming] = useState(false);

  return (
    <SubScreen
      title={t('brandLists.title')}
      testID={profileTestIDs.brandListsScreen}
      actions={[
        {
          icon: 'add',
          accessibilityLabel: t('brandLists.newList'),
          onPress: () => setNaming(true),
          testID: profileTestIDs.brandListsNew,
        },
      ]}
    >
      <View style={styles.content}>
        <Text role="body" tone="secondary">
          {t('brandLists.intro')}
        </Text>
        {loaded && lists.length === 0 ? (
          <EmptyState
            icon="list-outline"
            title={t('brandLists.emptyTitle')}
            description={t('brandLists.emptyBody')}
            action={{
              label: t('brandLists.newList'),
              onPress: () => setNaming(true),
            }}
          />
        ) : (
          <View>
            {lists.map(list => (
              <RowCard
                key={list.id}
                testID={profileTestIDs.brandListRow(list.id)}
              >
                <ListItem
                  title={list.name}
                  subtitle={t('brandLists.brandCount', {
                    count: list.brands.length,
                  })}
                  onPress={() => toBrandList({ listId: list.id })}
                  rightElement={
                    <BaseSwitch
                      value={list.enabled}
                      onValueChange={enabled => {
                        void setEnabled(list.id, enabled);
                      }}
                      accessibilityLabel={t('brandLists.useNamed', {
                        name: list.name,
                      })}
                      testID={profileTestIDs.brandListSwitch(list.id)}
                    />
                  }
                />
              </RowCard>
            ))}
          </View>
        )}
      </View>
      <TextEditBottomSheet
        visible={naming}
        title={t('brandLists.newList')}
        label={t('brandLists.nameLabel')}
        placeholder={t('brandLists.namePlaceholder')}
        initialValue=""
        fieldKey="name"
        validationSchema={brandListNameSchema}
        maxLength={100}
        onClose={() => setNaming(false)}
        onSave={name => {
          setNaming(false);
          void createList(name.trim()).then(id => {
            if (id) toBrandList({ listId: id });
          });
        }}
      />
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
}));
