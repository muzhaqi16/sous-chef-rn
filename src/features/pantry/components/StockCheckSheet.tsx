import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import { Sheet } from '#components/templates/Sheet';
import { DataStateView } from '#components/organisms/DataStateView';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { ChipScrollRow } from '#components/molecules/ChipScrollRow';
import { FractionInput } from '#components/molecules/FractionInput';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { formatRelativeToNow } from '#/utils/formatters/date';
import {
  StockCheckAnswer,
  StockConfidence,
  StockDoubtReason,
  WasteReason,
} from '#/graphql/generated/schemaTypes';
import { WASTE_REASON_OPTIONS } from '#features/pantry/utils/wasteReasons';
import { CollapsibleChipPicker } from './CollapsibleChipPicker';
import {
  useStockCheck,
  type StockCheckChoice,
  type StockCheckRow,
} from '../hooks/useStockCheck';
import { pantryTestIDs } from '../testIDs';

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

/**
 * Up to five doubtful stacks, each answered Still have, Some left, Used up or
 * Threw out. Only answered rows are sent; closing leaves the rest as they were.
 */
export const StockCheckSheet: React.FC<StockCheckSheetProps> = ({
  visible,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const { rows, asking, state, retry, answer } = useStockCheck(visible);
  // Each answer keeps the version its row showed when it was picked, so a
  // change that lands while the sheet is open is refused, never counted over.
  const [choices, setChoices] = useState<
    Partial<Record<string, { answer: StockCheckAnswer; seen?: number }>>
  >({});
  const [left, setLeft] = useState<Partial<Record<string, string>>>({});
  const [inside, setInside] = useState<Partial<Record<string, string>>>({});
  const [wasteReasons, setWasteReasons] = useState<
    Partial<Record<string, WasteReason>>
  >({});
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [noneAnswered, setNoneAnswered] = useState(false);

  // As the waste sheet does, until the household picks another.
  const reasonOf = (id: string): WasteReason =>
    wasteReasons[id] ?? WasteReason.Expired;

  const choiceOf = (
    row: StockCheckRow,
  ): StockCheckChoice | null | 'invalid' => {
    const picked = choices[row.id]?.answer;
    if (!picked) return null;
    if (picked === StockCheckAnswer.StillHave) {
      return { answer: StockCheckAnswer.StillHave };
    }
    if (picked === StockCheckAnswer.UsedUp) {
      return { answer: StockCheckAnswer.UsedUp };
    }
    if (picked === StockCheckAnswer.ThrewOut) {
      return { answer: StockCheckAnswer.ThrewOut, reason: reasonOf(row.id) };
    }
    const quantity = parseFractionalInput(left[row.id] ?? '');
    if (quantity === null || quantity < 0) return 'invalid';
    // What the packages found hold, as a recount takes it: never a fraction
    // of a package worked out by hand.
    const held = (inside[row.id] ?? '').trim();
    if (!held || !row.contents) {
      return { answer: StockCheckAnswer.SomeLeft, quantity };
    }
    const amount = parseFractionalInput(held);
    return amount === null || amount < 0
      ? 'invalid'
      : {
          answer: StockCheckAnswer.SomeLeft,
          quantity,
          contents: { amount, unitId: row.contents.unitId },
        };
  };

  const save = async () => {
    const found: Partial<Record<string, string>> = {};
    const answered = rows.flatMap(row => {
      const choice = choiceOf(row);
      if (choice === 'invalid') {
        found[row.id] = t('errors.invalidQuantity');
        return [];
      }
      if (!choice) return [];
      const seen = choices[row.id]?.seen;
      return [
        { row: seen === undefined ? row : { ...row, version: seen }, choice },
      ];
    });
    setErrors(found);
    const invalid = Object.keys(found).length > 0;
    setNoneAnswered(!invalid && answered.length === 0);
    if (invalid || answered.length === 0) return;
    setSaving(true);
    const { status, refused } = await answer(answered);
    setSaving(false);
    if (status === 'failed') return;
    if (refused.length === 0) {
      // Sent: a stack still listed next time is asked afresh, not pre-answered.
      setChoices({});
      setLeft({});
      setInside({});
      setWasteReasons({});
      onDismiss();
      return;
    }
    // A refused row keeps its answer and says why, to be looked at again.
    setErrors(
      Object.fromEntries(refused.map(row => [row.pantryItemId, row.message])),
    );
    const refusedIds = new Set(refused.map(row => row.pantryItemId));
    // Counted again, it goes against the version the row shows by then.
    setChoices(current =>
      Object.fromEntries(
        Object.entries(current)
          .filter(([id]) => refusedIds.has(id))
          .map(([id, choice]) => [id, choice && { answer: choice.answer }]),
      ),
    );
  };

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onDismiss}
      title={t('pantryScreen.stockCheckTitle')}
      snapPoints={['85%']}
      contentContainerStyle={styles.content}
    >
      {/* A check the device cannot read says so, never an empty check. */}
      {rows.length === 0 ? (
        <DataStateView state={state} onRetry={retry} />
      ) : null}
      {rows.map(row => {
        const picked = choices[row.id]?.answer ?? null;
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
                setChoices(current => ({
                  ...current,
                  [row.id]: { answer: next, seen: row.version },
                }));
                setNoneAnswered(false);
              }}
              edgeFadeColor="surface"
            />
            {picked === StockCheckAnswer.SomeLeft ? (
              <>
                <FractionInput
                  label={t('pantryScreen.stockCheckLeft', {
                    unit: row.unitSymbol,
                  })}
                  value={left[row.id] ?? ''}
                  onChangeText={text =>
                    setLeft(current => ({ ...current, [row.id]: text }))
                  }
                  error={errors[row.id]}
                  testID={pantryTestIDs.stockCheckLeft(row.id)}
                />
                {row.contents ? (
                  <FractionInput
                    label={t('pantryScreen.stockCheckInside', {
                      unit: row.contents.unitSymbol,
                    })}
                    value={inside[row.id] ?? ''}
                    onChangeText={text =>
                      setInside(current => ({ ...current, [row.id]: text }))
                    }
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
                selectedValue={reasonOf(row.id)}
                onSelect={reason =>
                  setWasteReasons(current => ({ ...current, [row.id]: reason }))
                }
              />
            ) : null}
            {picked !== StockCheckAnswer.SomeLeft && errors[row.id] ? (
              <Text role="error" tone="error">
                {errors[row.id]}
              </Text>
            ) : null}
          </View>
        );
      })}
      {noneAnswered ? (
        <Text role="error" tone="error">
          {t('pantryScreen.stockCheckNoneAnswered')}
        </Text>
      ) : null}
      <Button
        title={t('labels.save')}
        onPress={() => {
          void save();
        }}
        loading={saving}
        disabled={saving}
        testID={pantryTestIDs.stockCheckSave}
      />
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
