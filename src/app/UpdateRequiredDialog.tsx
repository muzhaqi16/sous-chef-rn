import React from 'react';
import { Platform, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Dialog, DialogBody, DialogFooter } from '#components/templates/Dialog';
import { Button } from '#components/molecules/Button';
import { Text } from '#components/atoms/Text';
import { useTranslation } from '#/i18n';
import { appConfig } from '#/config/appConfig';
import { openWebUrl } from '#native/externalUrl';
import { useIsClientUpgradeRequired } from '#store/useAppStore';

const STORE_LISTING = Platform.select({
  ios: appConfig.identity.storeListings.ios,
  android: appConfig.identity.storeListings.android,
});

// Android back must not dismiss it: the refusal stands until the app updates.
const stayOpen = () => undefined;

/**
 * The server refuses this build, so nothing works until the user updates. The
 * dialog cannot be dismissed and stays up across a trip to the store and back.
 */
export const UpdateRequiredDialog: React.FC = () => {
  const { t } = useTranslation();
  const required = useIsClientUpgradeRequired();

  const openStore = () => {
    // An https listing always opens: the store app claims it, else the browser.
    void openWebUrl(STORE_LISTING);
  };

  return (
    <Dialog visible={required} onRequestClose={stayOpen}>
      <DialogBody>
        <View style={styles.copy}>
          <Text role="heading" align="center" accessibilityRole="header">
            {t('appUpdate.title')}
          </Text>
          <Text role="body" tone="secondary" align="center">
            {t('appUpdate.message')}
          </Text>
        </View>
      </DialogBody>
      {STORE_LISTING ? (
        <DialogFooter>
          <Button onPress={openStore} fullWidth title={t('labels.update')} />
        </DialogFooter>
      ) : null}
    </Dialog>
  );
};

const styles = StyleSheet.create(theme => ({
  copy: {
    gap: theme.spacing.sm,
  },
}));
