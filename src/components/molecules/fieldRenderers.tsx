import React, { createContext, useContext, type ReactNode } from 'react';

/**
 * Everything a registered field renderer is given.
 *
 * `props` carries the field's own `props` bag verbatim, which is where a
 * renderer's specific callbacks live (`onSelectItem`, `onUnitSelected`, …).
 * Keeping them there rather than as named fields on `FieldDef` is what lets
 * `DynamicFormFields` stay domain-free: it forwards a bag it does not read.
 */
export interface FieldRenderContext {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  required: boolean;
  error?: string;
  testID?: string;
  props: Record<string, unknown>;
}

export interface FieldRendererEntry {
  render: (ctx: FieldRenderContext) => ReactNode;
  /**
   * The renderer shows validation errors itself, so `DynamicFormFields` must
   * not print a second error line beneath it.
   *
   * Declared per renderer because the app's renderers genuinely differ: five of
   * the six catalog pickers own their error display and the storage-location
   * one does not. That used to live as a five-way `!==` chain in
   * `DynamicFormFields`, where the sixth was absent by omission and nothing
   * said whether that was deliberate.
   */
  ownsErrorDisplay?: boolean;
}

export type FieldRendererRegistry = Record<string, FieldRendererEntry>;

const FieldRendererContext = createContext<FieldRendererRegistry>({});

/**
 * Supplies the renderers a `FieldDef`'s string `component` can name.
 *
 * `DynamicFormFields` is a generic schema-driven form; WHICH named field types
 * exist is an app decision. Mounting this once at the composition root is what
 * keeps the domain pickers out of the kit — and what lets a different app
 * register a different set without editing the form renderer.
 */
export const FieldRendererProvider = ({
  renderers,
  children,
}: {
  renderers: FieldRendererRegistry;
  children: ReactNode;
}) => (
  <FieldRendererContext.Provider value={renderers}>
    {children}
  </FieldRendererContext.Provider>
);

export const useFieldRenderers = (): FieldRendererRegistry =>
  useContext(FieldRendererContext);
