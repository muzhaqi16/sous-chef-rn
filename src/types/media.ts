/**
 * A picked or captured image, as it travels between the picker, the crop
 * screen and whatever uploads it. A plain data shape rather than a component
 * export, so the store can hold one without importing a component.
 */
export interface ImageFile {
  uri: string;
  fileName?: string;
  fileSize?: number;
  type?: string;
}
