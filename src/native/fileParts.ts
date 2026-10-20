import type { FileParts } from '#platform/ports';
import { firstNonBlank } from '#/utils/firstNonBlank';

/** React Native's FormData streams a file from disk given `{ uri, type, name }`. */
export const streamedFileParts: FileParts = {
  append: (form, name, file, mimeType) => {
    form.append(name, {
      uri: file.uri,
      type: mimeType,
      name: firstNonBlank(file.fileName) ?? 'image.jpg',
    });
  },
};
