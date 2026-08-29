/**
 * The English `validateImageFile` throws never reaches a user.
 *
 * Those three strings are log text by design — `onError` hands the error to
 * `errorService.reportError`, and an English sentence is what a report wants.
 * The defect was that three pickers ALSO put `error.message` straight into an
 * alert, under a translated title, so an es/it/sq user got "Only JPEG, PNG, and
 * WebP images are allowed" in a Spanish dialog.
 *
 * The split is the same one the app applies to a server message: the code maps
 * to copy this app owns; the message stays for the log. This asserts both
 * halves, so neither can quietly swap places again.
 */
import {
  validateImageFile,
  type ImageValidationError,
  MAX_PROFILE_SIZE,
  MAX_IMAGE_SIZE,
} from '#/utils/imageValidation';
import { imageErrorMessage } from '#hooks/useImageUpload';
import { mergedLocale } from '#/test-utils/mergedLocales';

/** The real English copy, so a wrong key is visible rather than plausible. */
const en = mergedLocale('en') as {
  imageUpload: Record<string, string>;
};

/** Stands in for i18next: resolves a key path and interpolates `{{size}}`. */
const t = ((key: string, opts?: Record<string, unknown>) => {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown>)?.[part],
      en,
    );
  if (typeof value !== 'string') throw new Error(`missing key: ${key}`);
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(opts?.[name]));
}) as unknown as Parameters<typeof imageErrorMessage>[0];

function thrownBy(
  file: Parameters<typeof validateImageFile>[0],
  isProfile = false,
) {
  try {
    validateImageFile(file, isProfile);
  } catch (error) {
    return error as ImageValidationError;
  }
  throw new Error('validateImageFile did not reject');
}

describe('what a rejected image shows the user', () => {
  it('maps a disallowed type to copy, not to the thrown English', () => {
    const error = thrownBy({ type: 'image/gif', fileSize: 100 });

    expect(error.code).toBe('INVALID_TYPE');
    // The message stays English — `onError` reports it.
    expect(error.message).toBe('Only JPEG, PNG, and WebP images are allowed');
    expect(imageErrorMessage(t, error, false)).toBe(
      en.imageUpload.invalidTypeBody,
    );
    expect(imageErrorMessage(t, error, false)).not.toBe(error.message);
  });

  it('maps an unreadable size to copy', () => {
    const error = thrownBy({ type: 'image/png' });

    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.message).toBe('Unable to determine file size');
    expect(imageErrorMessage(t, error, false)).toBe(
      en.imageUpload.unreadableBody,
    );
    expect(imageErrorMessage(t, error, false)).not.toBe(error.message);
  });

  it('names the limit that actually applied, profile or item', () => {
    const profile = thrownBy(
      { type: 'image/png', fileSize: MAX_PROFILE_SIZE + 1 },
      true,
    );
    const item = thrownBy({ type: 'image/png', fileSize: MAX_IMAGE_SIZE + 1 });

    expect(profile.code).toBe('FILE_TOO_LARGE');
    expect(item.code).toBe('FILE_TOO_LARGE');

    // Two different limits, so one sentence for both would be wrong wherever it
    // was not the one that fired.
    expect(imageErrorMessage(t, profile, true)).toContain(
      String(MAX_PROFILE_SIZE / 1024 / 1024),
    );
    expect(imageErrorMessage(t, item, false)).toContain(
      String(MAX_IMAGE_SIZE / 1024 / 1024),
    );
    expect(imageErrorMessage(t, profile, true)).not.toBe(
      imageErrorMessage(t, item, false),
    );
  });

  it('every locale carries the copy, so no reader falls back to English', () => {
    for (const locale of ['en', 'es', 'it', 'sq']) {
      const tree = mergedLocale(locale) as {
        imageUpload: Record<string, string>;
      };
      for (const key of [
        'invalidTypeBody',
        'unreadableBody',
        'profileTooLargeBody',
        'itemTooLargeBody',
      ]) {
        expect(typeof tree.imageUpload?.[key]).toBe('string');
      }
    }
  });
});
