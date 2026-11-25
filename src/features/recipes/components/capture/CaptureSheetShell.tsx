import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#i18n';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { Text } from '#components/atoms/Text';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { useOpening } from '#hooks/ui/useOpening';
import { recipesTestIDs } from '#features/recipes/testIDs';

interface CaptureSheetShellProps<Payload> {
  visible: boolean;
  /** Read as the sheet opens; the form keeps it while the sheet animates out. */
  payload?: Payload;
  snapPoint: string;
  onDismiss: () => void;
  /** The form, mounted fresh for each opening. */
  children: (payload: Payload | undefined) => React.ReactNode;
}

/** The sheet a capture form opens in. */
export function CaptureSheetShell<Payload>({
  visible,
  payload,
  snapPoint,
  onDismiss,
  children,
}: CaptureSheetShellProps<Payload>) {
  const opening = useOpening(visible, payload);

  return (
    <Sheet
      mode="form"
      headerFromContent
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={[snapPoint]}
      contentContainerStyle={styles.content}
    >
      {opening ? (
        <React.Fragment key={opening.id}>
          {children(opening.payload)}
        </React.Fragment>
      ) : null}
    </Sheet>
  );
}

interface CaptureFormFrameProps {
  title: string;
  onClose: () => void;
  /** Why the last send did not start, where no field can hold it. */
  failure: string | null;
  sending: boolean;
  /** Sends, or says on the form what is missing. */
  onSend: () => void;
  children: React.ReactNode;
}

/** A capture form's bar, with its send, and its connection note and failure around its fields. */
export const CaptureFormFrame: React.FC<CaptureFormFrameProps> = ({
  title,
  onClose,
  failure,
  sending,
  onSend,
  children,
}) => {
  const { t } = useTranslation();
  const unavailable = useIsApiUnavailable();

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={title}
          onClose={onClose}
          // Held only offline, which the note under the fields says.
          confirm={{
            onPress: onSend,
            accessibilityLabel: t('recipes.captureImport'),
            loading: sending,
            disabled: unavailable,
            testID: recipesTestIDs.captureSend,
          }}
        />
      </SheetHeaderSlot>
      {children}
      {unavailable ? (
        <Text role="caption" tone="warning" style={styles.note}>
          {t('recipes.captureNeedsConnection')}
        </Text>
      ) : null}
      {failure ? (
        <AlertBanner
          title={failure}
          icon="alert-circle-outline"
          iconLibrary="Ionicons"
        />
      ) : null}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingBottom: theme.spacing.md,
  },
  note: {
    marginBottom: theme.spacing.md,
  },
}));
