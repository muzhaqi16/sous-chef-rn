import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#styles/commonStyles';
import { useTranslation } from '#i18n';
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
  /** Leaves the sheet, or with `leading: 'back'` the step it shows. */
  onClose: () => void;
  /** `back` for a step inside one sheet, such as a form opened from a list. */
  leading?: 'close' | 'back';
  /** The sheet's confirm action; omit it for a sheet that only closes. */
  confirm?: SheetConfirm;
  borderless?: boolean;
  leadingTestID?: string;
  titleTestID?: string;
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
  leading = 'close',
  confirm,
  borderless,
  leadingTestID,
  titleTestID,
}) => {
  const { t } = useTranslation();
  return (
    <View
      style={[
        commonStyles.sheetHeaderBleed(contentPadding),
        !borderless && styles.belowDivider,
      ]}
    >
      <Header
        title={title}
        centerTitle
        onClose={leading === 'close' ? onClose : undefined}
        onBack={leading === 'back' ? onClose : undefined}
        borderless={borderless}
        leadingTestID={leadingTestID}
        titleTestID={titleTestID}
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

const styles = StyleSheet.create(theme => ({
  // The body starts clear of the divider in every sheet.
  belowDivider: {
    marginBottom: theme.spacing.md,
  },
}));
