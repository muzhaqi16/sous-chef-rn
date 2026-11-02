import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import { alertService } from '#/services/alertService';
import { destructiveConfirm } from '#/services/destructiveConfirm';
import { RowCard } from '#components/atoms/RowCard';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { EmptyState } from '#components/molecules/EmptyState';
import { SubScreen } from '#components/templates/SubScreen';
import {
  useChangesNotSaved,
  type ChangeNotSaved,
  type NotSavedReason,
} from '#features/profile/hooks/useChangesNotSaved';
import { profileTestIDs } from '#features/profile/testIDs';

const REASON_KEYS = {
  conflict: 'changesNotSaved.reasonConflict',
  expired: 'changesNotSaved.reasonExpired',
  gone: 'changesNotSaved.reasonGone',
  refused: 'changesNotSaved.reasonRefused',
} satisfies Record<NotSavedReason, TranslationKey>;

/** What the server would not take, each to retry or discard. */
const ChangesNotSavedScreen: React.FC = () => {
  const { t } = useTranslation();
  const { changes, retry, discard } = useChangesNotSaved();

  const confirmDiscard = (change: ChangeNotSaved) => {
    alertService.alert(
      t('changesNotSaved.discardTitle'),
      t('changesNotSaved.discardBody', { name: change.name }),
      destructiveConfirm(t('labels.discard'), () => discard(change.id)),
    );
  };

  return (
    <SubScreen
      title={t('changesNotSaved.title')}
      testID={profileTestIDs.changesNotSavedScreen}
    >
      <View style={styles.content}>
        {changes.length === 0 ? (
          <EmptyState
            icon="checkmark-circle-outline"
            title={t('changesNotSaved.emptyTitle')}
            description={t('changesNotSaved.emptyBody')}
          />
        ) : (
          <>
            <Text role="body" tone="secondary">
              {t('changesNotSaved.intro')}
            </Text>
            <View>
              {changes.map(change => (
                <RowCard
                  key={change.id}
                  testID={profileTestIDs.changeNotSavedRow(change.id)}
                >
                  <View style={styles.row}>
                    <Text role="bodyStrong">{change.name}</Text>
                    {change.entered.length > 0 && (
                      <Text role="body">{change.entered.join(' · ')}</Text>
                    )}
                    <Text role="caption" tone="secondary">
                      {t(REASON_KEYS[change.reason])}
                    </Text>
                    <View style={styles.actions}>
                      {!!change.canRetry && (
                        <Button
                          title={t('labels.retry')}
                          variant="primary"
                          size="small"
                          onPress={() => {
                            void retry(change.id);
                          }}
                          testID={profileTestIDs.changeNotSavedRetry(change.id)}
                        />
                      )}
                      <Button
                        title={t('labels.discard')}
                        variant="secondary"
                        size="small"
                        onPress={() => confirmDiscard(change)}
                        testID={profileTestIDs.changeNotSavedDiscard(change.id)}
                      />
                    </View>
                  </View>
                </RowCard>
              ))}
            </View>
          </>
        )}
      </View>
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  row: {
    paddingVertical: theme.layout.rowInset,
    paddingHorizontal: theme.layout.rowInsetHorizontal,
    gap: theme.spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
}));

export default ChangesNotSavedScreen;
