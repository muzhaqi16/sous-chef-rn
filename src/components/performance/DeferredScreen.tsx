import React from 'react';
import { useDeferredRender } from '#hooks/performance/useDeferredRender';

interface DeferredScreenProps {
  fallback: React.ReactNode;
  component: React.ComponentType;
}

/**
 * Wraps a heavy screen component with deferred rendering.
 * Shows `fallback` (skeleton) instantly; mounts `component` only after
 * `useDeferredRender()` returns true — structurally preventing heavy hooks
 * from running before the skeleton paints.
 */
export function DeferredScreen({ fallback, component: Component }: DeferredScreenProps) {
  const isReady = useDeferredRender();
  if (!isReady) return <>{fallback}</>;
  return <Component />;
}
