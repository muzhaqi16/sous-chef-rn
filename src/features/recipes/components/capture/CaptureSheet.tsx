import React, { useState } from 'react';
import { View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { object, string, type ObjectSchema } from 'yup';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { errorCopy } from '#/services/errorService';
import { FormInput } from '#components/atoms/FormInput';
import { FormTextArea } from '#components/atoms/FormTextArea';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { logValidationErrors } from '#/utils/validation/common';
import type {
  CaptureRequest,
  CaptureStart,
} from '#features/recipes/hooks/useRecipeCapture';
import { httpUrl } from '#features/recipes/screens/RecipeForm/recipeFormConfig';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { CaptureFormFrame, CaptureSheetShell } from './CaptureSheetShell';

export type CaptureSheetKind = 'link' | 'text';

/** What the server reads at most from shared text (`RECIPE_CAPTURE_MAX_CHARS`). */
export const MAX_CAPTURE_TEXT = 24_000;

interface CaptureFormValues {
  url: string;
  text: string;
  sourceUrl: string;
}

const captureFormDefaults: CaptureFormValues = {
  url: '',
  text: '',
  sourceUrl: '',
};

// A blank field passes: the send button waits for the one the sheet shows.
const captureFormSchema: ObjectSchema<CaptureFormValues> = object({
  url: httpUrl('recipes.captureLinkInvalid'),
  text: string().defined().trim(),
  sourceUrl: httpUrl('recipes.captureLinkInvalid'),
});

/** The error type of a refusal the server made, as against a rule the form holds. */
const REFUSED = 'refused';

const pasteLink = async (onChange: (value: string) => void) => {
  const pasted = (await Clipboard.getString()).trim();
  if (pasted) onChange(pasted);
};

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
  const [kind, setKind] = useState(initialKind);
  const [failure, setFailure] = useState<string | null>(null);
  const { control, handleSubmit, getValues, setValue, setError } =
    useForm<CaptureFormValues>({
      resolver: yupResolver(captureFormSchema),
      defaultValues: captureFormDefaults,
    });
  const [url, text] = useWatch({ control, name: ['url', 'text'] });
  const canSend = (kind === 'link' ? url : text).trim() !== '';

  const switchToText = () => {
    setKind('text');
    setValue('sourceUrl', getValues('url').trim());
  };

  // A refusal lands on the field that caused it, where the user can fix it.
  const showRefusal = (refusal: Extract<CaptureStart, { kind: 'refused' }>) => {
    switch (refusal.field) {
      case 'url':
        setError('url', {
          type: REFUSED,
          message: textAllowed
            ? t('recipes.captureLinkRefused')
            : t('recipes.captureLinkUnreadable'),
        });
        return;
      case 'text':
        setError('text', {
          type: REFUSED,
          message: t('recipes.captureTextTooLong'),
        });
        return;
      case 'sourceUrl':
        setError('sourceUrl', {
          type: REFUSED,
          message: t('recipes.captureLinkInvalid'),
        });
        return;
      case 'photos':
      case null:
        setFailure(
          errorCopy(refusal.error, t, t('recipes.captureFailedUnavailable')),
        );
    }
  };

  const send = handleSubmit(async values => {
    const outcome = await onSend(
      kind === 'link'
        ? { source: 'url', url: values.url }
        : {
            source: 'text',
            text: values.text,
            ...(values.sourceUrl ? { sourceUrl: values.sourceUrl } : {}),
          },
    );
    switch (outcome.kind) {
      case 'started':
        onClose();
        return;
      case 'limited':
        setFailure(t('recipes.captureLimited'));
        return;
      case 'refused':
        showRefusal(outcome);
    }
  }, logValidationErrors);

  return (
    <CaptureFormFrame
      title={
        kind === 'link'
          ? t('recipes.captureLinkTitle')
          : t('recipes.captureTextTitle')
      }
      onClose={onClose}
      failure={failure}
      sending={sending}
      canSend={canSend}
      onSend={() => {
        setFailure(null);
        void send();
      }}
    >
      {kind === 'link' ? (
        <Controller
          control={control}
          name="url"
          render={({ field, fieldState }) => (
            <>
              <FormInput
                label={t('recipes.captureLinkLabel')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder={t('recipes.captureLinkPlaceholder')}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                error={fieldState.error?.message}
                editable={!sending}
                useBottomSheetInput
                testID={recipesTestIDs.captureUrlInput}
              />
              <View style={styles.actions}>
                {textAllowed && fieldState.error?.type === REFUSED ? (
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
                      void pasteLink(field.onChange);
                    }}
                  >
                    {t('recipes.capturePasteLink')}
                  </Button>
                )}
              </View>
            </>
          )}
        />
      ) : (
        <>
          <Controller
            control={control}
            name="text"
            render={({ field, fieldState }) => (
              <FormTextArea
                label={t('recipes.captureTextLabel')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder={t('recipes.captureTextPlaceholder')}
                maxLength={MAX_CAPTURE_TEXT}
                numberOfLines={8}
                error={fieldState.error?.message}
                editable={!sending}
                testID={recipesTestIDs.captureTextInput}
              />
            )}
          />
          <Text role="footnote" tone="tertiary" style={styles.count}>
            {t('recipes.captureTextCount', {
              count: text.length,
              max: MAX_CAPTURE_TEXT,
            })}
          </Text>
          <Controller
            control={control}
            name="sourceUrl"
            render={({ field, fieldState }) => (
              <FormInput
                label={t('recipes.captureSourceLabel')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder={t('recipes.captureLinkPlaceholder')}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                error={fieldState.error?.message}
                editable={!sending}
                useBottomSheetInput
                testID={recipesTestIDs.captureSourceInput}
              />
            )}
          />
        </>
      )}
    </CaptureFormFrame>
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
}) => (
  <CaptureSheetShell
    visible={visible}
    payload={kind}
    snapPoint="85%"
    onDismiss={onDismiss}
  >
    {initialKind =>
      initialKind ? (
        <CaptureForm
          initialKind={initialKind}
          textAllowed={textAllowed}
          onSend={onSend}
          sending={sending}
          onClose={onDismiss}
        />
      ) : null
    }
  </CaptureSheetShell>
);

const styles = StyleSheet.create(theme => ({
  actions: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  count: {
    alignSelf: 'flex-end',
    marginBottom: theme.spacing.md,
  },
}));
