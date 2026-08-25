import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { Text } from '#components/atoms/Text';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { PrimaryActivityIndicator } from '#components/atoms/themedComponents';
import { useNavigation } from '@react-navigation/native';
import { commonStyles } from '#/styles/commonStyles';
import { useSelectedPantryId, useSelectedHomeId } from '#store/useAppStore';
import { extractNodes } from '#/utils/connectionUtils';
import { useApolloClient, useQuery } from '@apollo/client/react';
import { GetHomeDocument } from '#operations/home/home.generated';
import {
  GetPantryDocument,
  GetPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  PantryItemForm_PantryItemFragmentDoc,
  type PantryItemForm_PantryItemFragment,
  PantryItemForm_HomeFragmentDoc,
  type PantryItemForm_HomeFragment,
} from './PantryItemForm.generated';
import {
  StorageState,
  ItemCondition,
  type StorageLocation,
} from '#/graphql/generated/schemaTypes';
import { useUpdatePantryItem } from '#features/pantry/hooks/mutations/useUpdatePantryItem';
import { useUpdatePantryItemQuantity } from '#features/pantry/hooks/mutations/useUpdatePantryItemQuantity';
import { useResolveUnit } from '#features/pantry/hooks/mutations/useResolveUnit';
import {
  emptyUnitSelection,
  type UnitSelection,
} from '#features/pantry/hooks/mutations/types';
import {
  DynamicFormFields,
  FieldDef,
} from '#components/molecules/DynamicFormFields';
import { FormInput } from '#components/molecules/FormInput';
import { Header } from '#components/molecules/Header';
import { PageIndicator } from '#components/molecules/PageIndicator/PageIndicator';
import { CollapsibleSection } from '#components/molecules/CollapsibleSection';
import { ItemInformationSection } from './ItemInformationSection';
import { QuantitySection } from './QuantitySection';
import { StorageDetailsSection } from './StorageDetailsSection';
import { NetWeightSection } from './NetWeightSection';
import { usePantryItemFormSubmit } from './usePantryItemFormSubmit';
import { logValidationErrors } from '#utils/validation/common';
import {
  type PageName,
  PAGES,
  TAB_FIELDS,
  INVENTORY_ADVANCED_FIELDS,
  editItemSchema,
} from './pantryItemFormConfig';
import { formatNumberForInput } from '#/utils/formatters/number';

export interface PantryItemFormData {
  // Item information
  itemName?: string;
  selectedItemId?: string;
  brand?: string;

  // Quantity fields
  quantityInput?: string;
  unit: string; // Tracking unit (for counting items)

  tags?: string[];

  // Low stock settings
  minQuantity?: string;
  restockQuantity?: string;

  // Net weight
  netWeight?: string;
  netWeightUnit?: string;
  netWeightUnitId?: string;

  // Storage fields
  storageState: StorageState;
  condition: ItemCondition;
  location: string;
  expirationDate?: Date;
  notes: string;
  category: string;
}

interface PantryItemFormProps {
  /** The pantry item being edited. This form is edit-only. */
  itemId: string;
  onSuccess?: () => void;
}

/**
 * Edits an existing pantry item.
 *
 * This used to carry an `add` mode too — a second create path with its own
 * schema, defaults, item-picker and `useCreatePantryItem` hook. Nothing could
 * reach it: `PantryItem` registers with `linking: null`, and both callers of
 * `toPantryItem` pass an `itemId`. Adding goes through `AddToPantrySheet` →
 * `AddDetailsSheet` instead.
 *
 * It was not harmless while it sat there. Its create did its cache work in the
 * mutation's `update:` callback, which never runs when a write is queued
 * offline — the same defect that made offline adds invisible on the live path.
 * Two creates that disagree is how that class of bug survives a fix to one of
 * them.
 */
export const PantryItemForm: React.FC<PantryItemFormProps> = ({
  itemId,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { goBack } = useNavigation();

  // Consolidated unit state using UnitSelection type
  const [trackingUnit, setTrackingUnit] =
    useState<UnitSelection>(emptyUnitSelection);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [selectedStorageLocation, setSelectedStorageLocation] = useState<{
    id: string;
    name: string;
    type: string;
  } | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [netWeightUnitId, setNetWeightUnitId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(0);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const selectedPantryId = useSelectedPantryId();
  // Get selectedHomeId from Zustand (no GraphQL query triggered)
  const selectedHomeId = useSelectedHomeId();

  // Helper to get default pantry (inline to avoid useDefaultHome dependency)
  const getDefaultPantry = (home: PantryItemForm_HomeFragment | null) => {
    const pantries = extractNodes(home?.pantriesConnection);
    if (!pantries.length) return null;
    return pantries.find(p => p.isDefault) ?? pantries[0] ?? null;
  };

  const { data: homeData } = useQuery(GetHomeDocument, {
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId,
  });

  // Load the item being edited
  const {
    data: existingItemData,
    loading: itemLoading,
    refetch: refetchItem,
  } = useQuery(GetPantryItemDocument, {
    variables: { id: itemId ?? '' },
    skip: !itemId,
  });

  // Materialize the form's own narrow fragment from the cache. The screen's
  // `GetPantryItem` query selects this fragment via `...PantryItemForm_pantryItem`
  // in `PantryItemDetail_pantryItem`, so the cache is already populated.
  const apolloClient = useApolloClient();
  const existingPantryItem = existingItemData?.pantryItem
    ? apolloClient.cache.readFragment<PantryItemForm_PantryItemFragment>({
        fragment: PantryItemForm_PantryItemFragmentDoc,
        fragmentName: 'PantryItemForm_pantryItem',
        from: existingItemData.pantryItem,
      })
    : null;

  // Resolve the masked `home` ref to the form's own fragment so we can read
  // pantriesConnection (data masking hides it on the raw query result).
  const home = homeData?.home
    ? apolloClient.cache.readFragment<PantryItemForm_HomeFragment>({
        fragment: PantryItemForm_HomeFragmentDoc,
        fragmentName: 'PantryItemForm_home',
        from: homeData.home,
      })
    : null;
  const pantry = getDefaultPantry(home);
  const currentPantryId =
    selectedPantryId || pantry?.id || existingPantryItem?.pantryId;

  // Fetch pantry details to get storage locations
  const { data: pantryData } = useQuery(GetPantryDocument, {
    variables: { id: currentPantryId ?? '' },
    skip: !currentPantryId,
    fetchPolicy: 'cache-first',
  });

  const storageLocations = extractNodes(
    pantryData?.pantry?.storageLocationsConnection,
  ) as StorageLocation[];

  // Mutation hooks - modular pattern for maintainability
  const { updatePantryItemFields } = useUpdatePantryItem({
    onSuccess,
    refetch: refetchItem,
  });

  const { updateQuantity } = useUpdatePantryItemQuantity({
    onSuccess,
    refetch: refetchItem,
  });

  const { resolveUnitId } = useResolveUnit();

  const getInitialValues = (): PantryItemFormData => {
    if (existingPantryItem) {
      const item = existingPantryItem;
      // Tracking unit (for counting items) - from item.unit or item.unitName
      const trackingUnitSymbol = item.unit?.symbol || '';
      return {
        itemName: item.itemName || '',
        quantityInput: formatNumberForInput(item.quantity) || '1',
        unit: trackingUnitSymbol, // Tracking unit
        minQuantity: formatNumberForInput(item.minQuantity),
        restockQuantity: formatNumberForInput(item.restockQuantity),
        brand: item.brand?.name || '',
        netWeight: formatNumberForInput(item.netWeight),
        netWeightUnit:
          item.netWeightUnit?.symbol || item.netWeightUnit?.name || '',
        netWeightUnitId: item.netWeightUnit?.id || '',
        storageState: item.storageState || StorageState.Ambient,
        condition: item.condition || ItemCondition.Good,
        location:
          typeof item.storageLocation === 'string'
            ? item.storageLocation
            : item.storageLocation?.name || '',
        expirationDate: item.expiresAt ? new Date(item.expiresAt) : undefined,
        notes: item.storageNotes || '',
        category: item.item?.categories?.[0]?.category?.name || '',
        tags: item.tags || [],
      };
    }

    // Not loaded yet — the form shows a spinner until it is.
    return {
      itemName: '',
      brand: '',
      quantityInput: '1',
      unit: '', // Tracking unit
      minQuantity: '',
      restockQuantity: '',
      netWeight: '',
      netWeightUnit: '',
      netWeightUnitId: '',
      storageState: StorageState.Ambient,
      condition: ItemCondition.Good,
      location: '',
      notes: '',
      category: '',
    };
  };

  const {
    control,
    handleSubmit,
    formState: { errors, dirtyFields },
    setValue,
    reset,
  } = useForm<PantryItemFormData>({
    resolver: yupResolver(editItemSchema) as Resolver<PantryItemFormData>,
    defaultValues: getInitialValues(),
    mode: 'onChange',
  });

  const watchedValues = useWatch({ control });

  // "Adjusting state during render" pattern — avoids setState-in-useEffect lint error
  const [prevExistingItemData, setPrevExistingItemData] =
    useState<typeof existingItemData>();
  if (existingPantryItem && existingItemData !== prevExistingItemData) {
    setPrevExistingItemData(existingItemData);
    const item = existingPantryItem;
    const trackingUnitSymbol = item.unit?.symbol || '';
    reset({
      itemName: item.itemName || '',
      quantityInput: formatNumberForInput(item.quantity) || '1',
      unit: trackingUnitSymbol,
      minQuantity: formatNumberForInput(item.minQuantity),
      restockQuantity: formatNumberForInput(item.restockQuantity),
      brand: item.brand?.name || '',
      netWeight: formatNumberForInput(item.netWeight),
      netWeightUnit:
        item.netWeightUnit?.symbol || item.netWeightUnit?.name || '',
      netWeightUnitId: item.netWeightUnit?.id || '',
      storageState: item.storageState || StorageState.Ambient,
      condition: item.condition || ItemCondition.Good,
      location:
        typeof item.storageLocation === 'string'
          ? item.storageLocation
          : item.storageLocation?.name || '',
      expirationDate: item.expiresAt ? new Date(item.expiresAt) : undefined,
      notes: item.storageNotes || '',
      category: item.item?.categories?.[0]?.category?.name || '',
      tags: item.tags || [],
    });
    // Initialize tracking unit state from existing item
    if (item.unit) {
      setTrackingUnit({
        id: item.unit.id,
        name: item.unit.name,
        symbol: item.unit.symbol,
        type: item.unit.type ?? null,
      });
    }
    // Initialize net weight unit ID from existing item
    if (item.netWeightUnit?.id) {
      setNetWeightUnitId(item.netWeightUnit.id);
    }
  }

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
  };

  const handleStorageLocationSelect = (
    locationId: string | null,
    location: StorageLocation | null,
  ) => {
    setSelectedLocationId(locationId);
    setSelectedStorageLocation(
      locationId && location
        ? { id: locationId, name: location.name, type: location.type }
        : null,
    );

    if (location?.temperature) {
      const tempLower = location.temperature.toLowerCase();
      if (tempLower === 'frozen') {
        setValue('storageState', StorageState.Frozen, { shouldDirty: true });
      } else if (tempLower === 'refrigerated') {
        setValue('storageState', StorageState.Refrigerated, {
          shouldDirty: true,
        });
      } else if (tempLower === 'ambient') {
        setValue('storageState', StorageState.Ambient, { shouldDirty: true });
      }
    }
  };

  // Handler for adding a new storage location (user typed a custom name).
  // createPantryItem and updatePantryItem both find-or-create the location by
  // name on save (case-insensitive within the home, else a new CUSTOM location)
  // and return its id — so just record the typed name and clear any selected
  // id. Creating it server-side on save (vs eagerly) avoids orphaning a location
  // if the user cancels the edit.
  const handleAddNewLocation = (name: string) => {
    setValue('location', name, { shouldDirty: true });
    setSelectedLocationId(null);
  };

  const handleUnitSelected = (
    unitId: string | null,
    unitName: string | null,
    unitType?: string | null,
    unitSymbol?: string | null,
  ) => {
    setTrackingUnit(prev => ({
      ...prev,
      id: unitId,
      name: unitName,
      type: unitType ?? null,
      symbol: unitSymbol ?? null,
    }));
  };

  const handleNetWeightUnitSelected = (unitId: string | null) => {
    setNetWeightUnitId(unitId);
  };

  const item = existingPantryItem;
  const isWeightLocked = !!item?.lastUsedAt;

  const { handleSave } = usePantryItemFormSubmit({
    itemId,
    currentPantryId,
    isWeightLocked,
    existingPantryItem,
    dirtyFields: dirtyFields as Record<string, unknown>,
    trackingUnit,
    netWeightUnitId,
    selectedLocationId,
    selectedBrandId,
    selectedCategoryId,
    selectedStorageLocation,
    updatePantryItemFields,
    updateQuantity,
    resolveUnitId,
    onSuccess,
  });

  if (itemLoading) {
    return (
      <View style={[commonStyles.container, commonStyles.center]}>
        <PrimaryActivityIndicator size="large" />
      </View>
    );
  }

  if (!existingPantryItem) {
    return (
      <View style={[commonStyles.container, commonStyles.center]}>
        <Text style={styles.errorText}>{t('errors.itemNotFound')}</Text>
      </View>
    );
  }

  // Tags section fields
  const tagsFields: FieldDef<PantryItemFormData>[] = [
    {
      name: 'tags',
      label: t('itemForm.tags'),
      placeholder: t('itemForm.tagsPlaceholder'),
      component: FormInput,
      renderValue: (value: unknown) =>
        Array.isArray(value)
          ? value.join(', ')
          : typeof value === 'string'
          ? value
          : '',
      transformValue: (value: unknown) => {
        return String(value ?? '')
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean);
      },
      transformOnBlur: true,
    },
  ];

  const formTestID = 'edit-pantry-item-modal';

  // Per-tab error detection — drives the red dot on PageIndicator and
  // auto-expansion of "More options" when an errored field lives inside it.
  const fieldHasError = (name: string) =>
    !!(errors as Record<string, unknown>)[name];
  const tabHasError = (page: PageName) => {
    const fields =
      page === 'Inventory'
        ? [...TAB_FIELDS.Inventory, ...INVENTORY_ADVANCED_FIELDS]
        : TAB_FIELDS[page];
    return fields.some(fieldHasError);
  };
  const inventoryAdvancedHasError =
    INVENTORY_ADVANCED_FIELDS.some(fieldHasError);
  const showTags = tagsExpanded || inventoryAdvancedHasError;
  const indicatorPages = PAGES.map(page => ({
    label: page,
    hasError: tabHasError(page),
  }));

  return (
    <View testID={formTestID} style={styles.container}>
      <KeyboardAvoidingView
        style={commonStyles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Header
          variant="form"
          title={t('itemForm.editTitle')}
          onClose={() => goBack()}
          rightActions={[
            {
              icon: 'checkmark',
              onPress: handleSubmit(handleSave, logValidationErrors),
              variant: 'primary',
              testID: 'edit-pantry-item-submit-button',
            },
          ]}
        />

        <PageIndicator
          pages={indicatorPages}
          currentPage={currentPage}
          onPagePress={setCurrentPage}
        />

        <ScrollView
          style={commonStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageContent}>
            {currentPage === 0 && (
              <ItemInformationSection
                control={control}
                errors={errors}
                onBrandSelected={setSelectedBrandId}
                onCategorySelected={handleCategorySelect}
              />
            )}

            {currentPage === 1 && (
              <NetWeightSection
                control={control}
                isWeightLocked={isWeightLocked}
                onNetWeightUnitSelected={handleNetWeightUnitSelected}
              />
            )}

            {currentPage === 2 && (
              <StorageDetailsSection
                control={control}
                errors={errors}
                storageState={
                  watchedValues.storageState ?? StorageState.Ambient
                }
                condition={watchedValues.condition ?? ItemCondition.Good}
                expirationDate={watchedValues.expirationDate}
                onStorageStateChange={state =>
                  setValue('storageState', state, { shouldDirty: true })
                }
                onConditionChange={c =>
                  setValue('condition', c, { shouldDirty: true })
                }
                onDateChange={date => {
                  setValue('expirationDate', date ?? undefined, {
                    shouldDirty: true,
                  });
                }}
                storageLocations={storageLocations}
                onStorageLocationSelected={handleStorageLocationSelect}
                onAddNewLocation={handleAddNewLocation}
              />
            )}

            {currentPage === 3 && (
              <>
                <QuantitySection
                  control={control}
                  errors={errors}
                  onUnitSelected={handleUnitSelected}
                  testID="edit-pantry-item-quantity-input"
                  unitTestID="edit-pantry-item-unit-picker"
                  unitSymbol={item?.unit?.symbol}
                />

                <CollapsibleSection
                  title={t('labels.moreOptions')}
                  expanded={showTags}
                  onToggle={() => setTagsExpanded(prev => !prev)}
                >
                  <View style={styles.advancedContent}>
                    <DynamicFormFields
                      fields={tagsFields}
                      control={control}
                      errors={errors}
                    />
                  </View>
                </CollapsibleSection>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  errorText: {
    fontSize: theme.fonts.size.lg,
    color: theme.colors.error,
  },
  // Even page rhythm: matched side padding, a little room under the page
  // indicator, and generous space below the last field so it clears the
  // keyboard without feeling cramped.
  pageContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  advancedContent: {
    paddingTop: theme.spacing.md,
  },
}));
