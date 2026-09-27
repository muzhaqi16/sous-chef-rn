import React from 'react';
import { View } from 'react-native';
import { commonStyles } from '#/styles/commonStyles';
import { useTranslation } from '#/i18n';
import { Header } from '#components/organisms/Header';

interface SheetConfirm {
  onPress: () => void;
  /** Defaults to "Save". */
  accessibilityLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}

interface SheetHeaderProps {
  /** Horizontal padding on the parent sheet body, cancelled for the header. */
  contentPadding?: 'md' | 'lg';
  title: string;
  onClose: () => void;
  /** The sheet's confirm action; omit it for a sheet that only closes. */
  confirm?: SheetConfirm;
  borderless?: boolean;
}

/**
 * A form sheet's header: close on the leading side, the title centred, confirm
 * on the trailing side — the same bar, glyph positions and confirm colour in
 * every sheet, as `FormScreen` gives a full-screen form.
 */
export const SheetHeader: React.FC<SheetHeaderProps> = ({
  contentPadding,
  title,
  onClose,
  confirm,
  borderless,
}) => {
  const { t } = useTranslation();
  return (
    <View style={commonStyles.sheetHeaderBleed(contentPadding)}>
      <Header
        title={title}
        centerTitle
        onClose={onClose}
        borderless={borderless}
        rightActions={
          confirm
            ? [
                {
                  icon: 'checkmark',
                  accessibilityLabel:
                    confirm.accessibilityLabel ?? t('labels.save'),
                  onPress: confirm.onPress,
                  variant: 'primary',
                  disabled: !!confirm.disabled || !!confirm.loading,
                  loading: confirm.loading,
                  testID: confirm.testID,
                },
              ]
            : []
        }
      />
    </View>
  );
};
