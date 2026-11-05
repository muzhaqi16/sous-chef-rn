import { useTranslation } from '#/i18n';

interface FieldAccessibilityInput {
  /** The label shown above the field. */
  label?: string;
  required?: boolean;
  error?: string;
  /** A caller's own name for the field, used in place of `label`. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * A text field's accessible name and hint. The name is the visible label, never
 * the placeholder TalkBack falls back to; "required" and the current error ride
 * along.
 */
export function useFieldAccessibility({
  label,
  required = false,
  error,
  accessibilityLabel,
  accessibilityHint,
}: FieldAccessibilityInput) {
  const { t } = useTranslation();
  const name = accessibilityLabel ?? label;
  const errorHint = error ? t('a11y.fieldError', { error }) : undefined;

  return {
    accessibilityLabel:
      required && name ? t('a11y.requiredField', { label: name }) : name,
    accessibilityHint:
      accessibilityHint && errorHint
        ? t('a11y.hintWithError', { hint: accessibilityHint, error: errorHint })
        : errorHint ?? accessibilityHint,
  };
}
