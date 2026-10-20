import { useAppearance } from '#hooks/ui/useAppearance';
import { useCoreLifecycle } from '#bootstrap/useCoreLifecycle';
import { useMobileStartupHost } from './mobileStartupHost';

/**
 * App-root lifecycle orchestrator. Order is load-bearing: appearance before
 * any paint, then the core's lifecycle with this device's start-up steps.
 */
export function useAppLifecycle(): void {
  useAppearance();
  const startupHost = useMobileStartupHost();
  useCoreLifecycle(startupHost);
}
