import { within, type screen } from '@testing-library/react-native';

/**
 * The control labelled `label` nearest `inside`: a sheet's Save beside its
 * title, where every closed sheet Jest renders has a Save of its own.
 */
export function controlNear(
  inside: ReturnType<typeof screen.getByText>,
  label: string,
) {
  for (let node = inside.parent; node; node = node.parent) {
    const [control] = within(node).queryAllByLabelText(label);
    if (control) return control;
  }
  throw new Error(`nothing labelled ${label} near the element given`);
}
