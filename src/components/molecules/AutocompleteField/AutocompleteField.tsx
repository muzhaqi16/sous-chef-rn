import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { InlineAutocomplete } from '../InlineAutocomplete';
import { BottomSheetAutocompleteInput } from '../BottomSheetAutocompleteInput';

interface SharedProps<TItem> {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  testID?: string;
  items: TItem[];
  loading?: boolean;
  renderItem: (item: TItem, index: number) => React.ReactNode;
  keyExtractor: (item: TItem) => string;
  onSelect: (item: TItem) => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  showAddNew?: boolean;
  addNewLabel?: string;
  addNewSubtext?: string;
  onAddNew?: () => void;
}

interface InlineVariantProps<TItem> extends SharedProps<TItem> {
  variant: 'inline';
  minSearchLength?: number;
  maxResults?: number;
  debounceMs?: number;
}

interface ModalVariantProps<TItem> extends SharedProps<TItem> {
  variant: 'modal';
  title: string;
  searchPlaceholder: string;
  emptyText: string;
  emptySubtext?: string;
  snapPoint?: string;
  minSearchLength?: number;
  onSearchChange?: (text: string) => void;
  onModalOpen?: () => void;
  onModalClose?: () => void;
}

export type AutocompleteFieldProps<TItem> =
  | InlineVariantProps<TItem>
  | ModalVariantProps<TItem>;

function AddNewFooter({
  label,
  subtext,
  onPress,
}: {
  label: string;
  subtext?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        footerStyles.container,
        pressed && footerStyles.pressed,
      ]}
    >
      <Text style={footerStyles.icon}>+</Text>
      <View style={footerStyles.content}>
        <Text style={footerStyles.label}>{label}</Text>
        {subtext && <Text style={footerStyles.subtext}>{subtext}</Text>}
      </View>
    </Pressable>
  );
}

const footerStyles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceVariant,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  icon: {
    fontSize: theme.typography.fontSize.xl,
    width: 32,
    textAlign: 'center',
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
  },
  subtext: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
}));

export function AutocompleteField<TItem>(props: AutocompleteFieldProps<TItem>) {
  const addNewFooter = useMemo(() => {
    if (!props.showAddNew || !props.onAddNew || !props.addNewLabel) return null;
    return (
      <AddNewFooter
        label={props.addNewLabel}
        subtext={props.addNewSubtext}
        onPress={props.onAddNew}
      />
    );
  }, [props.showAddNew, props.onAddNew, props.addNewLabel, props.addNewSubtext]);

  if (props.variant === 'inline') {
    return (
      <InlineAutocomplete<TItem>
        label={props.label}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        required={props.required}
        error={props.error}
        testID={props.testID}
        items={props.items}
        loading={props.loading}
        minSearchLength={props.minSearchLength}
        maxResults={props.maxResults}
        debounceMs={props.debounceMs}
        renderItem={props.renderItem}
        keyExtractor={props.keyExtractor}
        onSelect={props.onSelect}
        autoCapitalize={props.autoCapitalize}
        footerComponent={addNewFooter}
      />
    );
  }

  // Modal variant - adapt renderItem to match BottomSheetAutocompleteInput's expected signature
  const modalRenderItem = (item: TItem) => props.renderItem(item, 0) as React.ReactElement;

  return (
    <BottomSheetAutocompleteInput<TItem>
      label={props.label}
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      required={props.required}
      error={props.error}
      testID={props.testID}
      title={props.title}
      searchPlaceholder={props.searchPlaceholder}
      minSearchLength={props.minSearchLength}
      snapPoint={props.snapPoint}
      data={props.items}
      loading={props.loading}
      renderItem={modalRenderItem}
      keyExtractor={props.keyExtractor}
      onSelectItem={props.onSelect}
      emptyText={props.emptyText}
      emptySubtext={props.emptySubtext}
      onSearchChange={props.onSearchChange}
      onModalOpen={props.onModalOpen}
      onModalClose={props.onModalClose}
      autoCapitalize={props.autoCapitalize}
      listFooterComponent={addNewFooter}
    />
  );
}
