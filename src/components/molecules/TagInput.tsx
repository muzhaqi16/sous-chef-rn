import React, { useState, useRef, useEffect } from 'react';
import { View, Keyboard, ScrollView } from 'react-native';
import {
  Pressable,
  ThemedBottomSheetTextInput,
} from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

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
  placeholder = 'Add a tag...',
  maxTags = 10,
  editable = true,
}) => {
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

  const filteredSuggestions = (() => {
    if (!inputValue.trim()) return [];
    const query = inputValue.toLowerCase();
    return suggestions
      .filter(
        suggestion =>
          suggestion.toLowerCase().includes(query) &&
          !tags.includes(suggestion),
      )
      .slice(0, 5);
  })();

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
    if (e.nativeEvent.key === 'Backspace' && !inputValue && tags.length > 0) {
      handleRemoveTag(tags[tags.length - 1]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Tags display */}
      <View style={styles.tagsContainer}>
        {tags.map((tag, index) => (
          <View key={`${tag}-${index}`} style={styles.tagChip}>
            <Text size="sm" tone="accent" weight="medium">
              {tag}
            </Text>
            {!!editable && (
              <Pressable
                onPress={() => handleRemoveTag(tag)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Icon name="close" size={14} tone="primary" />
              </Pressable>
            )}
          </View>
        ))}

        {/* Input field */}
        {!!editable && tags.length < maxTags && (
          <ThemedBottomSheetTextInput
            key={inputKey}
            style={styles.input}
            defaultValue={inputValue}
            onChangeText={setInputValue}
            placeholder={tags.length === 0 ? placeholder : ''}
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
        <Text size="sm" tone="secondary" align="right">
          Maximum {maxTags} tags reached
        </Text>
      )}

      {/* Suggestions dropdown */}
      {!!isFocused && filteredSuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredSuggestions.map((suggestion, index) => (
              <Pressable
                key={`${suggestion}-${index}`}
                style={({ pressed }) => [
                  styles.suggestionChip,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  handleAddTag(suggestion);
                  Keyboard.dismiss();
                }}
              >
                <Text size="sm" tone="secondary">
                  {suggestion}
                </Text>
              </Pressable>
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
    padding: theme.spacing['3'],
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    minHeight: 48,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: theme.spacing.xs,
    paddingLeft: theme.spacing['3'],
    paddingRight: theme.spacing.sm,
    borderRadius: theme.radii.full,
    gap: theme.spacing.xs,
  },
  input: {
    flex: 1,
    minWidth: 80,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: 0,
  },
  suggestionsContainer: {
    paddingVertical: theme.spacing.sm,
  },
  suggestionChip: {
    backgroundColor: theme.colors.background,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.full,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
