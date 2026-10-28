import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
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
 * It draws over `children`, never in a native Modal, so a screen or alert
 * already presented on iOS covers it until closed instead of losing it.
 */
export const UpdateRequiredGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation();
  const required = useIsClientUpgradeRequired();
  const [storeFailed, setStoreFailed] = useState(false);
  const titleRef = useRef<View>(null);

  // What it covers is hidden from screen readers, so focus moves to it.
  useEffect(() => {
    const title = titleRef.current;
    if (required && title) {
      AccessibilityInfo.sendAccessibilityEvent(title, 'focus');
    }
  }, [required]);

  // The store app claims an https listing, else the browser does; a device with
  // neither is told here, since nothing else can show above this dialog.
  const openStore = () => {
    void openWebUrl(STORE_LISTING).then(opened => setStoreFailed(!opened));
  };

  return (
    <>
      <View
        style={styles.app}
        importantForAccessibility={required ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={required}
      >
        {children}
      </View>
      <Dialog inTree visible={required} onRequestClose={stayOpen}>
        <DialogBody>
          <View style={styles.copy}>
            <View ref={titleRef} accessible accessibilityRole="header">
              <Text role="heading" align="center">
                {t('appUpdate.title')}
              </Text>
            </View>
            <Text role="body" tone="secondary" align="center">
              {t('appUpdate.message')}
            </Text>
            {storeFailed ? (
              <Text
                role="error"
                tone="error"
                align="center"
                accessibilityRole="alert"
              >
                {t('appUpdate.storeNotOpened')}
              </Text>
            ) : null}
          </View>
        </DialogBody>
        {STORE_LISTING ? (
          <DialogFooter>
            <Button onPress={openStore} fullWidth title={t('labels.update')} />
          </DialogFooter>
        ) : null}
      </Dialog>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  app: {
    flex: 1,
  },
  copy: {
    gap: theme.spacing.sm,
  },
}));
