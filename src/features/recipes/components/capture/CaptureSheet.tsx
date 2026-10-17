import React, { useState } from 'react';
import { View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { FormInput } from '#components/atoms/FormInput';
import { FormTextArea } from '#components/atoms/FormTextArea';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import type {
  CaptureRequest,
  CaptureStart,
} from '#features/recipes/hooks/useRecipeCapture';
import type { CaptureField } from '#features/recipes/utils/recipeCaptureOutcome';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { useOpening } from '#hooks/ui/useOpening';

export type CaptureSheetKind = 'link' | 'text';

/** What the server reads at most from shared text (`RECIPE_CAPTURE_MAX_CHARS`). */
export const MAX_CAPTURE_TEXT = 24_000;

const isWebLink = (value: string) => /^https?:\/\/\S+\.\S+$/i.test(value);

interface CaptureFormProps {
  initialKind: CaptureSheetKind;
  textAllowed: boolean;
  onSend: (request: CaptureRequest) => Promise<CaptureStart>;
  sending: boolean;
  onClose: () => void;
}

const CaptureForm: React.FC<CaptureFormProps> = ({
  initialKind,
  textAllowed,
  onSend,
  sending,
  onClose,
}) => {
  const { t } = useTranslation();
  const unavailable = useIsApiUnavailable();
  const [kind, setKind] = useState(initialKind);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  // A refusal the server made, shown where the user can fix it.
  const [urlError, setUrlError] = useState<string | null>(null);
  const [linkRefused, setLinkRefused] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const trimmedUrl = url.trim();
  const trimmedText = text.trim();
  const trimmedSource = sourceUrl.trim();
  const ready =
    !unavailable && (kind === 'link' ? trimmedUrl !== '' : trimmedText !== '');

  const pasteLink = async () => {
    const pasted = (await Clipboard.getString()).trim();
    if (pasted) setUrl(pasted);
  };

  const switchToText = () => {
    setKind('text');
    setSourceUrl(trimmedUrl);
    setUrlError(null);
    setLinkRefused(false);
  };

  // A refusal lands on the field that caused it, where the user can fix it.
  const showRefusal = (field: CaptureField | null) => {
    switch (field) {
      case 'url':
        setUrlError(
          textAllowed
            ? t('recipes.captureLinkRefused')
            : t('recipes.captureLinkUnreadable'),
        );
        setLinkRefused(true);
        return;
      case 'text':
        setTextError(t('recipes.captureTextTooLong'));
        return;
      case 'sourceUrl':
        setSourceError(t('recipes.captureLinkInvalid'));
        return;
      case 'photos':
      case null:
        setFailure(t('recipes.captureFailedUnavailable'));
    }
  };

  const show = (outcome: CaptureStart) => {
    switch (outcome.kind) {
      case 'started':
        onClose();
        return;
      case 'limited':
        setFailure(t('recipes.captureLimited'));
        return;
      case 'upgrade':
        setFailure(t('errors.codes.clientUpgradeRequired'));
        return;
      case 'disabled':
        setFailure(t('errors.codes.featureDisabled'));
        return;
      case 'premium':
        setFailure(t('errors.codes.premiumRequired'));
        return;
      case 'refused':
        showRefusal(outcome.field);
    }
  };

  const send = async () => {
    setFailure(null);
    if (kind === 'link') {
      if (!isWebLink(trimmedUrl)) {
        setUrlError(t('recipes.captureLinkInvalid'));
        return;
      }
      show(await onSend({ source: 'url', url: trimmedUrl }));
      return;
    }
    if (trimmedSource && !isWebLink(trimmedSource)) {
      setSourceError(t('recipes.captureLinkInvalid'));
      return;
    }
    show(
      await onSend({
        source: 'text',
        text: trimmedText,
        ...(trimmedSource ? { sourceUrl: trimmedSource } : {}),
      }),
    );
  };

  return (
    <>
      <SheetHeader
        contentPadding="md"
        title={
          kind === 'link'
            ? t('recipes.captureLinkTitle')
            : t('recipes.captureTextTitle')
        }
        onClose={onClose}
      />
      {kind === 'link' ? (
        <>
          <FormInput
            label={t('recipes.captureLinkLabel')}
            value={url}
            onChangeText={next => {
              setUrl(next);
              setUrlError(null);
              setLinkRefused(false);
            }}
            placeholder={t('recipes.captureLinkPlaceholder')}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            error={urlError ?? undefined}
            editable={!sending}
            useBottomSheetInput
            testID={recipesTestIDs.captureUrlInput}
          />
          <View style={styles.actions}>
            {linkRefused && textAllowed ? (
              <Button
                variant="outline"
                size="small"
                onPress={switchToText}
                testID={recipesTestIDs.captureUseText}
              >
                {t('recipes.captureUseTextInstead')}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="small"
                icon="clipboard-outline"
                onPress={() => {
                  void pasteLink();
                }}
              >
                {t('recipes.capturePasteLink')}
              </Button>
            )}
          </View>
        </>
      ) : (
        <>
          <FormTextArea
            label={t('recipes.captureTextLabel')}
            value={text}
            onChangeText={next => {
              setText(next);
              setTextError(null);
            }}
            placeholder={t('recipes.captureTextPlaceholder')}
            maxLength={MAX_CAPTURE_TEXT}
            numberOfLines={8}
            error={textError ?? undefined}
            editable={!sending}
            testID={recipesTestIDs.captureTextInput}
          />
          <Text role="footnote" tone="tertiary" style={styles.count}>
            {t('recipes.captureTextCount', {
              count: text.length,
              max: MAX_CAPTURE_TEXT,
            })}
          </Text>
          <FormInput
            label={t('recipes.captureSourceLabel')}
            value={sourceUrl}
            onChangeText={next => {
              setSourceUrl(next);
              setSourceError(null);
            }}
            placeholder={t('recipes.captureLinkPlaceholder')}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            error={sourceError ?? undefined}
            editable={!sending}
            useBottomSheetInput
            testID={recipesTestIDs.captureSourceInput}
          />
        </>
      )}
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
        onPress={() => {
          void send();
        }}
        loading={sending}
        disabled={!ready}
        testID={recipesTestIDs.captureSend}
      >
        {t('recipes.captureImport')}
      </Button>
    </>
  );
};

interface CaptureSheetProps {
  visible: boolean;
  kind: CaptureSheetKind;
  /** A refused link offers the page's text instead. */
  textAllowed: boolean;
  /**
   * Starts the capture. It comes from the screen: the sheet renders outside
   * the navigator, and the capture's outcome toast navigates.
   */
  onSend: (request: CaptureRequest) => Promise<CaptureStart>;
  sending: boolean;
  onDismiss: () => void;
}

/** A recipe from a page's link, or from text the user pastes. */
export const CaptureSheet: React.FC<CaptureSheetProps> = ({
  visible,
  kind,
  textAllowed,
  onSend,
  sending,
  onDismiss,
}) => {
  const opening = useOpening(visible, kind);

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={['85%']}
      contentContainerStyle={styles.content}
    >
      {opening?.payload ? (
        <CaptureForm
          key={opening.id}
          initialKind={opening.payload}
          textAllowed={textAllowed}
          onSend={onSend}
          sending={sending}
          onClose={onDismiss}
        />
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  actions: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  count: {
    alignSelf: 'flex-end',
    marginBottom: theme.spacing.md,
  },
  note: {
    marginBottom: theme.spacing.md,
  },
}));
