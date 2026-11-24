import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { object, string, type ObjectSchema } from 'yup';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { PrimaryActivityIndicator } from '#components/atoms/themedComponents';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { Button } from '#components/molecules/Button';
import type { HomeLinkPreview } from '#features/home/utils/shareLink';
import { lazyMessage, reportValidationErrors } from '#/utils/validation/common';

interface JoinHomeFormValues {
  code: string;
}

const joinHomeSchema: ObjectSchema<JoinHomeFormValues> = object({
  code: string().trim().required(lazyMessage('labels.pleaseEnterAJoinCode')),
});

/** A code this long can name a home, so leaving the field looks it up. */
const PREVIEW_MIN_LENGTH = 4;

interface JoinHomeFormProps {
  /** Receives the trimmed code; a blank one never reaches it. */
  onSubmit: (code: string) => Promise<void>;
  onPreview: (code: string) => void;
  onCancel: () => void;
  isJoining: boolean;
  loadingPreview: boolean;
  preview: HomeLinkPreview | null;
}

export const JoinHomeForm: React.FC<JoinHomeFormProps> = ({
  onSubmit,
  onPreview,
  onCancel,
  isJoining,
  loadingPreview,
  preview,
}) => {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<JoinHomeFormValues>({
    resolver: yupResolver(joinHomeSchema),
    defaultValues: { code: '' },
  });

  return (
    <View style={styles.joinForm}>
      <Controller
        control={control}
        name="code"
        render={({ field, fieldState }) => (
          <BaseInput
            value={field.value}
            onChangeText={field.onChange}
            onBlur={() => {
              field.onBlur();
              const code = field.value.trim();
              if (code.length >= PREVIEW_MIN_LENGTH) onPreview(code);
            }}
            placeholder={t('labels.enterJoinCode')}
            autoCapitalize="characters"
            errorMessage={fieldState.error?.message}
          />
        )}
      />
      {!!loadingPreview && (
        <PrimaryActivityIndicator size="small" style={styles.previewLoader} />
      )}
      {!!preview && (
        <View style={styles.previewCard}>
          <Text role="heading" style={styles.previewTitle}>
            {preview.name}
          </Text>
          <Text role="caption" style={styles.previewSubtitle}>
            {t('labels.memberCount', { count: preview.memberCount ?? 0 })}
          </Text>
        </View>
      )}
      <View style={styles.formActions}>
        <Button variant="secondary" onPress={onCancel} fullWidth>
          {t('labels.cancel')}
        </Button>
        <Button
          loading={isJoining}
          onPress={handleSubmit(
            ({ code }) => onSubmit(code),
            reportValidationErrors,
          )}
          variant="primary"
          style={styles.button}
        >
          {t('homeManagement.join')}
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  joinForm: {
    backgroundColor: theme.colors.surface,
  },
  formActions: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
  },
  previewLoader: {
    marginVertical: theme.spacing.sm,
  },
  previewCard: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    gap: theme.spacing.xs,
  },
  previewTitle: {
    color: theme.colors.textPrimary,
  },
  previewSubtitle: {
    color: theme.colors.textSecondary,
  },
}));
