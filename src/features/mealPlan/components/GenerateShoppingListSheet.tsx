import React from 'react';
import { View } from 'react-native';
import { Controller, useController, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { boolean, mixed, object, string, type ObjectSchema } from 'yup';
import { useTranslation } from '#i18n';
import {
  Pressable,
  PrimaryActivityIndicator,
} from '#components/atoms/themedComponents';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { RadioRow } from '#components/molecules/RadioRow';
import { DataStateView } from '#components/organisms/DataStateView';
import { FormInput } from '#components/atoms/FormInput';
import { useShoppingListsLite } from '#features/shoppingList/hooks/useShoppingListsLite';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { useOpening } from '#hooks/ui/useOpening';
import { lazyMessage, reportValidationErrors } from '#utils/validation/common';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';

type Destination = 'new' | 'existing';

interface GenerateShoppingListFormValues {
  checkPantry: boolean;
  mode: Destination;
  /** A new list's name; blank takes the plan's. */
  name: string;
  /** Null until a list is picked; needed only for an existing list. */
  shoppingListId: string | null;
}

const generateShoppingListDefaults: GenerateShoppingListFormValues = {
  checkPantry: true,
  mode: 'new',
  name: '',
  shoppingListId: null,
};

const generateShoppingListSchema: ObjectSchema<GenerateShoppingListFormValues> =
  object({
    checkPantry: boolean().defined(),
    mode: mixed<Destination>().oneOf(['new', 'existing']).defined(),
    name: string().trim().defined(),
    shoppingListId: string()
      .nullable()
      .defined()
      .when('mode', {
        is: 'existing',
        then: schema =>
          schema.required(lazyMessage('generateShoppingList.selectListLabel')),
      }),
  });

interface GenerateShoppingListSheetProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (options: {
    checkPantry?: boolean;
    name?: string;
    shoppingListId?: string;
  }) => void;
  loading: boolean;
  homeName?: string | null;
}

type GenerateShoppingListFormProps = Omit<
  GenerateShoppingListSheetProps,
  'visible'
>;

const GenerateShoppingListForm: React.FC<GenerateShoppingListFormProps> = ({
  onClose,
  onGenerate,
  loading,
  homeName,
}) => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<GenerateShoppingListFormValues>({
    resolver: yupResolver(generateShoppingListSchema),
    defaultValues: generateShoppingListDefaults,
  });
  useSheetUnsavedInput(isDirty);
  const { field: mode } = useController({
    control,
    name: 'mode',
    // The list rule reads the destination, so a new one re-runs it.
    rules: { deps: ['shoppingListId'] },
  });

  const {
    lists: shoppingLists,
    state: listsState,
    refetch: refetchLists,
  } = useShoppingListsLite({ fetchPolicy: 'cache-first' });

  const generate = handleSubmit(
    ({ checkPantry, mode: destination, name, shoppingListId }) => {
      onGenerate({
        checkPantry,
        name: destination === 'new' && name ? name : undefined,
        shoppingListId:
          destination === 'existing' ? shoppingListId ?? undefined : undefined,
      });
    },
    reportValidationErrors,
  );

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('mealPlanMain.generateShoppingListLabel')}
          onClose={onClose}
          confirm={{
            onPress: () => {
              void generate();
            },
            accessibilityLabel: t('generateShoppingList.generate'),
            loading,
          }}
        />
      </SheetHeaderSlot>

      {/* Home sharing info */}
      {!!homeName && (
        <View style={styles.infoNote}>
          <Icon
            name="information-circle-outline"
            size="xsPlus"
            tone="primary"
          />
          <Text role="caption" tone="accent" style={styles.infoNoteText}>
            {t('generateShoppingList.sharedWithHome', { name: homeName })}
          </Text>
        </View>
      )}

      {/* Check pantry toggle */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text role="bodyStrong">{t('generateShoppingList.checkPantry')}</Text>
          <Text
            role="caption"
            tone="secondary"
            style={styles.toggleDescription}
          >
            {t('generateShoppingList.checkPantryDesc')}
          </Text>
        </View>
        <Controller
          control={control}
          name="checkPantry"
          render={({ field }) => (
            <BaseSwitch
              accessibilityLabel={t('generateShoppingList.checkPantry')}
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
        />
      </View>

      {/* Mode selector */}
      <View style={styles.section}>
        <Text role="label" tone="secondary">
          {t('generateShoppingList.destination')}
        </Text>
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => mode.onChange('new')}
            style={[
              styles.modeOption,
              mode.value === 'new' && styles.modeOptionActive,
            ]}
          >
            <Icon
              name="add-circle-outline"
              size="sm"
              tone={mode.value === 'new' ? 'onPrimary' : 'textSecondary'}
            />
            <Text
              role="label"
              style={[
                styles.modeText,
                mode.value === 'new' && styles.modeTextActive,
              ]}
            >
              {t('generateShoppingList.newList')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => mode.onChange('existing')}
            style={[
              styles.modeOption,
              mode.value === 'existing' && styles.modeOptionActive,
            ]}
          >
            <Icon
              name="list-outline"
              size="sm"
              tone={mode.value === 'existing' ? 'onPrimary' : 'textSecondary'}
            />
            <Text
              role="label"
              style={[
                styles.modeText,
                mode.value === 'existing' && styles.modeTextActive,
              ]}
            >
              {t('generateShoppingList.existingList')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Custom name for new list */}
      {mode.value === 'new' && (
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <FormInput
              label={t('generateShoppingList.listNameLabel')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('generateShoppingList.listNamePlaceholder')}
            />
          )}
        />
      )}

      {/* Existing list picker */}
      {mode.value === 'existing' && (
        <Controller
          control={control}
          name="shoppingListId"
          render={({ field, fieldState }) => (
            <View style={styles.section}>
              <Text role="label" tone="secondary">
                {t('generateShoppingList.selectListLabel')}
              </Text>
              {listsState === 'error' || listsState === 'offline' ? (
                <DataStateView
                  state={listsState}
                  onRetry={() => {
                    void refetchLists();
                  }}
                />
              ) : shoppingLists.length === 0 ? (
                <Text
                  role="caption"
                  tone="tertiary"
                  align="center"
                  style={styles.emptyMessage}
                >
                  {t('generateShoppingList.noLists')}
                </Text>
              ) : (
                shoppingLists.map(list => (
                  <RadioRow
                    key={list.id}
                    selected={field.value === list.id}
                    onPress={() => field.onChange(list.id)}
                    style={[
                      styles.listItem,
                      field.value === list.id && styles.listItemSelected,
                    ]}
                  >
                    <View style={styles.listItemContent}>
                      <Text role="bodyStrong">{list.name}</Text>
                      <Text role="caption" tone="secondary">
                        {t('labels.itemCount', {
                          count: list.totalItems,
                        })}
                      </Text>
                    </View>
                  </RadioRow>
                ))
              )}
              {fieldState.error ? (
                <Text role="error" tone="error">
                  {fieldState.error.message}
                </Text>
              ) : null}
            </View>
          )}
        />
      )}

      {!!loading && (
        <View style={styles.spinnerRow}>
          <PrimaryActivityIndicator size="small" />
          <Text role="caption" tone="secondary">
            {t('generateShoppingList.generatingMessage')}
          </Text>
        </View>
      )}
    </>
  );
};

export const GenerateShoppingListSheet: React.FC<
  GenerateShoppingListSheetProps
> = ({ visible, ...form }) => {
  const opening = useOpening(visible);

  return (
    <Sheet
      visible={visible}
      onDismiss={form.onClose}
      snapPoints={['65%']}
      mode="form"
      headerFromContent
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
    >
      {opening ? <GenerateShoppingListForm key={opening.id} {...form} /> : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  infoNoteText: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  toggleInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  toggleDescription: {
    marginTop: theme.spacing['2xs'],
  },
  section: {
    gap: theme.spacing.sm,
  },
  modeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
  },
  modeOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  modeText: {
    color: theme.colors.textSecondary,
  },
  modeTextActive: {
    color: theme.colors.onPrimary,
  },
  listItem: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    gap: theme.spacing.sm,
  },
  listItemSelected: {
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.primary,
  },
  listItemContent: {
    flex: 1,
  },
  emptyMessage: {
    paddingVertical: theme.spacing.md,
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
}));
