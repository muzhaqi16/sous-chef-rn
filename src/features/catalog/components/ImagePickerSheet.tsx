import React, { useRef } from 'react';
import { useTranslation } from '#i18n';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { Sheet } from '#components/templates/Sheet';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';

interface ImagePickerSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onCamera: () => void;
  onLibrary: () => void;
}

/**
 * Camera or library. The choice runs once the sheet has finished closing: the
 * system picker cannot present over a sheet still on screen.
 */
export const ImagePickerSheet: React.FC<ImagePickerSheetProps> = ({
  visible,
  onDismiss,
  onCamera,
  onLibrary,
}) => {
  const { t } = useTranslation();
  const chosen = useRef<(() => void) | null>(null);

  const choose = (action: () => void) => {
    chosen.current = action;
    onDismiss();
  };

  return (
    <Sheet
      mode="action"
      visible={visible}
      onDismiss={() => {
        const action = chosen.current;
        chosen.current = null;
        onDismiss();
        action?.();
      }}
      snapPoints={[]}
      enableDynamicSizing
      title={t('imagePicker.addPhoto')}
      modalOptions={{ stackBehavior: 'push' }}
    >
      <View style={styles.optionsContainer}>
        <AppPressable style={styles.option} onPress={() => choose(onCamera)}>
          <View style={styles.iconContainer}>
            <Icon name="camera" size="md" tone="primary" />
          </View>
          <Text role="bodyStrong">{t('labels.takePhoto')}</Text>
        </AppPressable>
        <AppPressable style={styles.option} onPress={() => choose(onLibrary)}>
          <View style={styles.iconContainer}>
            <Icon name="image" size="md" tone="primary" />
          </View>
          <Text role="bodyStrong">{t('imagePicker.chooseFromLibrary')}</Text>
        </AppPressable>
      </View>
      <AppPressable style={styles.cancelButton} onPress={onDismiss}>
        <Text role="bodyStrong" tone="secondary">
          {t('labels.cancel')}
        </Text>
      </AppPressable>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  optionsContainer: {
    gap: theme.spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
}));
