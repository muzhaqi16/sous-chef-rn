import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
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
  /** Whether the form holds something to send. */
  canSend: boolean;
  onSend: () => void;
  children: React.ReactNode;
}

/** A capture form's title, connection note, failure and send button around its fields. */
export const CaptureFormFrame: React.FC<CaptureFormFrameProps> = ({
  title,
  onClose,
  failure,
  sending,
  canSend,
  onSend,
  children,
}) => {
  const { t } = useTranslation();
  const unavailable = useIsApiUnavailable();

  return (
    <>
      <SheetHeader contentPadding="md" title={title} onClose={onClose} />
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
      <Button
        onPress={onSend}
        loading={sending}
        disabled={unavailable || !canSend}
        testID={recipesTestIDs.captureSend}
      >
        {t('recipes.captureImport')}
      </Button>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  note: {
    marginBottom: theme.spacing.md,
  },
}));
