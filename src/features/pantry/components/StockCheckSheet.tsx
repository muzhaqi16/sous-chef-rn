import React from 'react';
import { View } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#i18n';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { DataStateView } from '#components/organisms/DataStateView';
import { Text } from '#components/atoms/Text';
import { ChipScrollRow } from '#components/molecules/ChipScrollRow';
import { FractionInput } from '#components/molecules/FractionInput';
import { formatRelativeToNow } from '#utils/formatters/date';
import {
  StockCheckAnswer,
  StockConfidence,
  StockDoubtReason,
} from '#graphql/generated/schemaTypes';
import { useOpening } from '#hooks/ui/useOpening';
import { reportValidationErrors } from '#utils/validation/common';
import { WASTE_REASON_OPTIONS } from '#features/pantry/utils/wasteReasons';
import { CollapsibleChipPicker } from './CollapsibleChipPicker';
import { useStockCheck } from '../hooks/useStockCheck';
import { pantryTestIDs } from '../testIDs';
import {
  DEFAULT_WASTE_REASON,
  stockCheckChoice,
  stockCheckSchema,
  type StockCheckFormValues,
} from './stockCheckFormConfig';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';

const ANSWERS: readonly StockCheckAnswer[] = [
  StockCheckAnswer.StillHave,
  StockCheckAnswer.SomeLeft,
  StockCheckAnswer.UsedUp,
  StockCheckAnswer.ThrewOut,
];

const answerLabel = (answer: StockCheckAnswer): TranslationKey => {
  switch (answer) {
    case StockCheckAnswer.SomeLeft:
      return 'pantryScreen.stockCheckSomeLeft';
    case StockCheckAnswer.UsedUp:
      return 'pantryScreen.stockCheckUsedUp';
    case StockCheckAnswer.ThrewOut:
      return 'pantryScreen.stockCheckThrewOut';
    case StockCheckAnswer.StillHave:
    default:
      return 'pantryScreen.stockCheckStillHave';
  }
};

/**
 * How sure the server is the stack is still there; a stack it gave no answer
 * for is not known, never sure. Null for a level this build predates.
 */
const levelLabel = (level: StockConfidence | null): TranslationKey | null => {
  switch (level) {
    case null:
      return 'pantryScreen.stockLevelUnknown';
    case StockConfidence.High:
      return 'pantryScreen.stockLevelHigh';
    case StockConfidence.Medium:
      return 'pantryScreen.stockLevelMedium';
    case StockConfidence.Low:
      return 'pantryScreen.stockLevelLow';
    default:
      return null;
  }
};

/** Why the server doubts a stack, in the app's words; null for one this build predates. */
const reasonLabel = (reason: StockDoubtReason): TranslationKey | null => {
  switch (reason) {
    case StockDoubtReason.NotConfirmedRecently:
      return 'pantryScreen.stockDoubtNotConfirmed';
    case StockDoubtReason.PastExpiry:
      return 'pantryScreen.stockDoubtPastExpiry';
    case StockDoubtReason.PastPredictedRunOut:
      return 'pantryScreen.stockDoubtPastRunOut';
    case StockDoubtReason.PredictedRunOutSoon:
      return 'pantryScreen.stockDoubtRunOutSoon';
    default:
      return null;
  }
};

interface StockCheckSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

type StockCheck = ReturnType<typeof useStockCheck>;

type StockCheckFormProps = Pick<
  StockCheck,
  'rows' | 'asking' | 'state' | 'retry' | 'answer'
> & { onDismiss: () => void };

/** One opening's answers: a stack still listed next time is asked afresh. */
const StockCheckForm: React.FC<StockCheckFormProps> = ({
  rows,
  asking,
  state,
  retry,
  answer,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<StockCheckFormValues>({
    resolver: yupResolver(stockCheckSchema),
    defaultValues: { rows: {} },
  });
  useSheetUnsavedInput(isDirty);
  const answers = useWatch({ control, name: 'rows' });

  const onValid = async (values: StockCheckFormValues) => {
    const answered = rows.flatMap(row => {
      const choice = stockCheckChoice(row, values.rows[row.id]);
      if (!choice) return [];
      const seen = values.rows[row.id]?.seen;
      return [
        { row: seen === undefined ? row : { ...row, version: seen }, choice },
      ];
    });
    if (answered.length === 0) {
      setError('root.noneAnswered', {
        message: t('pantryScreen.stockCheckNoneAnswered'),
      });
      return;
    }
    const { status, refused } = await answer(answered);
    if (status === 'failed') return;
    if (refused.length === 0) {
      onDismiss();
      return;
    }
    // A refused row keeps its answer and says why, to be looked at again;
    // counted again, it goes against the version the row shows by then.
    reset({
      rows: Object.fromEntries(
        refused.map(({ pantryItemId }) => [
          pantryItemId,
          { ...values.rows[pantryItemId], seen: undefined },
        ]),
      ),
    });
    for (const { pantryItemId, message, field } of refused) {
      const counted =
        values.rows[pantryItemId]?.answer === StockCheckAnswer.SomeLeft;
      setError(`rows.${pantryItemId}.${refusedField(field, counted)}`, {
        message,
      });
    }
  };

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('pantryScreen.stockCheckTitle')}
          onClose={onDismiss}
          confirm={{
            onPress: () => {
              void handleSubmit(onValid, reportValidationErrors)();
            },
            loading: isSubmitting,
            testID: pantryTestIDs.stockCheckSave,
          }}
        />
      </SheetHeaderSlot>
      {/* A check the device cannot read says so, never an empty check. */}
      {rows.length === 0 ? (
        <DataStateView state={state} onRetry={retry} />
      ) : null}
      {rows.map(row => {
        const picked = answers[row.id]?.answer ?? null;
        const rowError = errors.rows?.[row.id]?.answer?.message;
        // While today's answer is on its way, yesterday's evidence is not shown.
        const evidence = asking
          ? []
          : [
              ...[levelLabel(row.level), ...row.reasons.map(reasonLabel)]
                .filter((key): key is TranslationKey => key !== null)
                .map(key => t(key)),
              ...(row.lastConfirmedAt
                ? [
                    t('pantryScreen.stockLastConfirmed', {
                      when: formatRelativeToNow(new Date(row.lastConfirmedAt)),
                    }),
                  ]
                : []),
            ];
        return (
          <View
            key={row.id}
            style={styles.row}
            testID={pantryTestIDs.stockCheckRow(row.id)}
          >
            <View style={styles.rowHead}>
              <Text role="bodyStrong" style={styles.name}>
                {row.name}
              </Text>
              <Text role="body" tone="secondary">
                {row.amount}
              </Text>
            </View>
            {evidence.length > 0 ? (
              <Text role="caption" tone="secondary">
                {evidence.join(' · ')}
              </Text>
            ) : null}
            <ChipScrollRow
              options={ANSWERS.map(option => ({
                key: option,
                label: t(answerLabel(option)),
                testID: pantryTestIDs.stockCheckAnswer(row.id, option),
              }))}
              selected={picked}
              onSelect={key => {
                const next = ANSWERS.find(option => option === key);
                if (!next) return;
                setValue(`rows.${row.id}.answer`, next, { shouldDirty: true });
                setValue(`rows.${row.id}.seen`, row.version);
                clearErrors('root.noneAnswered');
                clearErrors([`rows.${row.id}.answer`, `rows.${row.id}.left`]);
              }}
              edgeFadeColor="surface"
            />
            {picked === StockCheckAnswer.SomeLeft ? (
              <>
                <Controller
                  control={control}
                  name={`rows.${row.id}.left`}
                  render={({ field, fieldState }) => (
                    <FractionInput
                      label={t('pantryScreen.stockCheckLeft', {
                        unit: row.unitSymbol,
                      })}
                      value={field.value ?? ''}
                      onChangeText={field.onChange}
                      error={fieldState.error?.message}
                      testID={pantryTestIDs.stockCheckLeft(row.id)}
                    />
                  )}
                />
                {row.contents ? (
                  <Controller
                    control={control}
                    name={`rows.${row.id}.inside`}
                    render={({ field, fieldState }) => (
                      <FractionInput
                        label={t('pantryScreen.stockCheckInside', {
                          unit: row.contents?.unitSymbol,
                        })}
                        value={field.value ?? ''}
                        onChangeText={field.onChange}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                ) : null}
              </>
            ) : null}
            {picked === StockCheckAnswer.ThrewOut ? (
              <CollapsibleChipPicker
                label={t('recordWaste.wasteReason')}
                options={WASTE_REASON_OPTIONS.map(({ labelKey, value }) => ({
                  label: t(labelKey),
                  value,
                }))}
                selectedValue={answers[row.id]?.reason ?? DEFAULT_WASTE_REASON}
                onSelect={reason =>
                  setValue(`rows.${row.id}.reason`, reason, {
                    shouldDirty: true,
                  })
                }
              />
            ) : null}
            {rowError ? (
              <Text role="error" tone="error">
                {rowError}
              </Text>
            ) : null}
          </View>
        );
      })}
      {errors.root?.noneAnswered ? (
        <Text role="error" tone="error">
          {errors.root.noneAnswered.message}
        </Text>
      ) : null}
    </>
  );
};

/**
 * Up to five doubtful stacks, each answered Still have, Some left, Used up or
 * Threw out. Only answered rows are sent; closing leaves the rest as they were.
 */
/**
 * The row field a refusal goes on: the input the server names, else the amount
 * when one was counted, as that is what is checked again, else the answer,
 * whose message sits under the waste reason too.
 */
const refusedField = (
  field: string | null,
  counted: boolean,
): 'left' | 'inside' | 'answer' => {
  switch (field) {
    case 'quantity':
      return 'left';
    case 'remainingNetWeight':
    case 'remainingNetWeightUnitId':
      return 'inside';
    case 'wasteReason':
      return 'answer';
    case null:
    default:
      return counted ? 'left' : 'answer';
  }
};

export const StockCheckSheet: React.FC<StockCheckSheetProps> = ({
  visible,
  onDismiss,
}) => {
  const { rows, asking, state, retry, answer } = useStockCheck(visible);
  const opening = useOpening(visible);

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onDismiss}
      headerFromContent
      snapPoints={['85%']}
      contentContainerStyle={styles.content}
    >
      {opening ? (
        <StockCheckForm
          key={opening.id}
          rows={rows}
          asking={asking}
          state={state}
          retry={retry}
          answer={answer}
          onDismiss={onDismiss}
        />
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  row: {
    gap: theme.spacing.sm,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
  },
  name: {
    flex: 1,
  },
}));
