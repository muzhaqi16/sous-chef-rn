import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '#i18n';
import { View, Keyboard, ScrollView } from 'react-native';
import { ThemedTextInput } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { filterByTerm, identity } from '#hooks/search/useLocalSearch';
import { MAX_TAG_LENGTH, MAX_TAGS } from '#utils/validation/entryLimits';
import { Chip } from '#components/molecules/Chip';

export interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
  editable?: boolean;
}

export const TagInput: React.FC<TagInputProps> = ({
  tags,
  onTagsChange,
  suggestions = [],
  placeholder,
  maxTags = MAX_TAGS,
  editable = true,
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [inputKey, setInputKey] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // An empty input shows nothing here, unlike a list filter: these are
  // type-ahead suggestions, and every tag is not a suggestion.
  const filteredSuggestions = (
    inputValue.trim()
      ? filterByTerm(suggestions, inputValue, [identity]).filter(
          suggestion => !tags.includes(suggestion),
        )
      : []
  ).slice(0, 5);

  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < maxTags) {
      onTagsChange([...tags, trimmedTag]);
      setInputValue('');
      setInputKey(k => k + 1);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = () => {
    if (inputValue.trim()) {
      handleAddTag(inputValue);
    }
  };

  const handleKeyPress = (e: { nativeEvent: { key: string } }) => {
    // Handle backspace to remove last tag when input is empty
    const lastTag = tags[tags.length - 1];
    if (e.nativeEvent.key === 'Backspace' && !inputValue && lastTag) {
      handleRemoveTag(lastTag);
    }
  };

  return (
    <View style={styles.container}>
      {/* Tags display */}
      <View style={styles.tagsContainer}>
        {tags.map((tag, index) => (
          <Chip
            key={`${tag}-${index}`}
            label={tag}
            removable
            disabled={!editable}
            onPress={() => handleRemoveTag(tag)}
            accessibilityLabel={t('a11y.removeNamed', { name: tag })}
          />
        ))}

        {/* Input field */}
        {!!editable && tags.length < maxTags && (
          <ThemedTextInput
            key={inputKey}
            style={styles.input}
            defaultValue={inputValue}
            onChangeText={setInputValue}
            // The API holds a tag to this length, trimmed.
            maxLength={MAX_TAG_LENGTH}
            placeholder={
              tags.length === 0 ? placeholder ?? t('tagInput.placeholder') : ''
            }
            onSubmitEditing={handleSubmit}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              // Clear any existing timeout before setting a new one
              if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
              }
              // Delay to allow suggestion tap
              blurTimeoutRef.current = setTimeout(() => {
                if (inputValue.trim()) {
                  handleAddTag(inputValue);
                }
              }, 200);
            }}
            onKeyPress={handleKeyPress}
            autoCapitalize="none"
            autoCorrect={false}
            submitBehavior="submit"
          />
        )}
      </View>
      {/* Tag limit indicator */}
      {!!editable && tags.length >= maxTags && (
        <Text role="caption" tone="secondary" align="right">
          {t('tagInput.maxTagsReached', { count: maxTags })}
        </Text>
      )}
      {/* Suggestions dropdown */}
      {!!isFocused && filteredSuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.suggestions}
          >
            {filteredSuggestions.map((suggestion, index) => (
              <Chip
                key={`${suggestion}-${index}`}
                label={suggestion}
                onPress={() => {
                  handleAddTag(suggestion);
                  Keyboard.dismiss();
                }}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    gap: theme.spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.base,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    minHeight: 48,
  },
  input: {
    flex: 1,
    minWidth: 80,
    ...theme.type.body,
    color: theme.colors.textPrimary,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: 0,
  },
  suggestionsContainer: {
    paddingVertical: theme.spacing.sm,
  },
  suggestions: {
    gap: theme.spacing.sm,
  },
}));
