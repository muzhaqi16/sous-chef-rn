import React, { createContext, useContext, type ReactNode } from 'react';

/**
 * `props` carries the field's own bag verbatim, where a renderer's specific
 * callbacks live. Keeping them there is what lets `DynamicFormFields` stay
 * domain-free: it forwards a bag it never reads.
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
   * The renderer shows validation errors itself, so `DynamicFormFields` must not
   * print a second line. Declared per renderer because they genuinely differ.
   */
  ownsErrorDisplay?: boolean;
}

export type FieldRendererRegistry = Record<string, FieldRendererEntry>;

const FieldRendererContext = createContext<FieldRendererRegistry>({});

/**
 * Supplies the renderers a `FieldDef`'s string `component` can name. Mounted once
 * at the composition root, which is what keeps the domain pickers out of the kit.
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
