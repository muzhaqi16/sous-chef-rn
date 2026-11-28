import { useImperativeHandle, useState } from 'react';
import { ActionTray } from '#components/templates/ActionTray/ActionTray';
import { SelectorContent } from './SelectorContent';
import { ActionButtons } from './ActionButtons';
import type { AnimatedItemSelectorProps, SelectableItem } from './types';

// React 19 ref-as-prop keeps the component generic over the item type `T`
// (a `forwardRef` would erase the generic and force a cast at the call site).
export const AnimatedItemSelector = <T extends SelectableItem>({
  config,
  isVisible,
  onClose,
  onOpen,
  ref,
}: AnimatedItemSelectorProps<T>) => {
  // A host drives it with `isVisible`, or through the ref, which opens it here.
  const [openedByRef, setOpenedByRef] = useState(false);
  const visible = isVisible ?? openedByRef;

  useImperativeHandle(ref, () => ({
    open: () => setOpenedByRef(true),
    close: () => setOpenedByRef(false),
    isActive: () => visible,
    toggle: () => setOpenedByRef(open => !open),
  }));

  return (
    <ActionTray
      visible={visible}
      title={config.title}
      headerActions={config.headerActions}
      onDismiss={() => {
        setOpenedByRef(false);
        onClose?.();
      }}
      onOpen={onOpen}
      showCloseButton={true}
      enableBackdrop={true}
      // Only mount the footer when there are actions: ActionButtons renders
      // null for an empty list, but passing it anyway would still make
      // ActionTray draw the bordered footer band and reserve its space.
      footer={
        config.actions.length ? (
          <ActionButtons actions={config.actions} />
        ) : undefined
      }
    >
      <SelectorContent config={config} />
    </ActionTray>
  );
};
