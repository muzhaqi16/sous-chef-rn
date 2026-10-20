import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#/i18n';
import type { CreateUserReportInput } from '#/graphql/generated/schemaTypes';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { FormTextArea } from '#components/atoms/FormTextArea';
import { Label } from '#components/atoms/Label';
import { Text } from '#components/atoms/Text';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { Button } from '#components/molecules/Button';
import { RadioRow } from '#components/molecules/RadioRow';
import { toastService } from '#services/toastService';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { logValidationErrors } from '#/utils/validation/common';
import { useReportContent } from '#features/profile/hooks/useReportContent';
import { REPORT_TYPE_LABEL_KEYS } from '#features/profile/utils/reportLabels';
import { profileTestIDs } from '#features/profile/testIDs';
import {
  REPORT_REASONS,
  reportContentDefaults,
  reportContentSchema,
  type ReportContentFormValues,
} from './reportContentFormConfig';
import { useOpening } from '#hooks/ui/useOpening';

/** Who is reported and, with both content fields, which of their content. */
export type ReportTarget = Pick<
  CreateUserReportInput,
  'reportedUserId' | 'contentType' | 'contentId'
>;

interface ReportContentFormProps {
  target: ReportTarget;
  onClose: () => void;
}

const ReportContentForm: React.FC<ReportContentFormProps> = ({
  target,
  onClose,
}) => {
  const { t } = useTranslation();
  const { reportContent } = useReportContent();
  const [sending, setSending] = useState(false);
  // The submission's failure; a field's own message stays on the field.
  const [failure, setFailure] = useState<string | null>(null);
  const { control, handleSubmit } = useForm<ReportContentFormValues>({
    resolver: yupResolver(reportContentSchema),
    defaultValues: reportContentDefaults,
  });

  const send = handleSubmit(async ({ type, description }) => {
    if (!type) return;
    setFailure(null);
    setSending(true);
    const outcome = await reportContent({
      ...target,
      type,
      description: firstNonBlank(description),
    });
    setSending(false);

    switch (outcome.status) {
      case 'failed':
        // The sheet stays open with what was written.
        setFailure(outcome.body);
        return;
      case 'alreadyOpen':
        toastService.info(t('reports.alreadyOpen'));
        break;
      case 'sent':
        toastService.success(t('reports.sent'));
        break;
    }
    onClose();
  }, logValidationErrors);

  return (
    <>
      <SheetHeader
        contentPadding="md"
        title={t('reports.sheetTitle')}
        onClose={onClose}
      />

      <Controller
        control={control}
        name="type"
        // The description rule reads the reason, so a new reason re-runs it.
        rules={{ deps: ['description'] }}
        render={({ field, fieldState }) => (
          <View accessibilityRole="radiogroup" style={styles.field}>
            <Label required>{t('labels.reason')}</Label>
            {REPORT_REASONS.map(reason => (
              <RadioRow
                key={reason}
                selected={field.value === reason}
                disabled={sending}
                onPress={() => field.onChange(reason)}
                style={styles.reason}
                testID={profileTestIDs.reportReason(reason)}
              >
                <Text role="body" style={styles.reasonLabel}>
                  {t(REPORT_TYPE_LABEL_KEYS[reason])}
                </Text>
              </RadioRow>
            ))}
            {fieldState.error ? (
              <Text role="error" tone="error">
                {fieldState.error.message}
              </Text>
            ) : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field, fieldState }) => (
          <FormTextArea
            label={t('reports.descriptionLabel')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('reports.descriptionPlaceholder')}
            error={fieldState.error?.message}
            editable={!sending}
            testID={profileTestIDs.reportDescriptionInput}
          />
        )}
      />

      {!!failure && (
        <AlertBanner
          title={failure}
          icon="alert-circle-outline"
          iconLibrary="Ionicons"
          testID={profileTestIDs.reportFailure}
        />
      )}

      <Button
        onPress={() => {
          void send();
        }}
        loading={sending}
        testID={profileTestIDs.reportSendButton}
      >
        {t('reports.send')}
      </Button>
    </>
  );
};

interface ReportContentSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Read when the sheet opens; the caller may clear it as the sheet closes. */
  target: ReportTarget | null;
}

/** Reports another user's recipe, review or profile to the moderators. */
export const ReportContentSheet: React.FC<ReportContentSheetProps> = ({
  visible,
  onDismiss,
  target,
}) => {
  const opening = useOpening(visible && target !== null, target);

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={['90%']}
      contentContainerStyle={styles.content}
    >
      {opening?.payload ? (
        <ReportContentForm
          key={opening.id}
          target={opening.payload}
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
  field: {
    marginBottom: theme.spacing.md,
  },
  reason: {
    gap: theme.spacing.base,
    paddingVertical: theme.spacing.smPlus,
  },
  reasonLabel: {
    flex: 1,
  },
}));
