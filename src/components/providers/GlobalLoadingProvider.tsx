import React from 'react';
import { useAppStore } from '#store/useAppStore';
import { LoadingOverlay } from '#components/organisms/LoadingOverlay';

/**
 * Global loading provider that shows overlay based on store state
 */
export const GlobalLoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const globalLoading = useAppStore(state => state.globalLoading);
  const clearGlobalLoading = useAppStore(state => state.clearGlobalLoading);

  const handleCancel = () => {
    if (globalLoading.cancelable) {
      clearGlobalLoading();
    }
  };

  return (
    <>
      {children}
      <LoadingOverlay
        visible={globalLoading.isLoading}
        message={globalLoading.message}
        transparent={globalLoading.context === 'navigation'}
        cancelable={globalLoading.cancelable}
        onCancel={handleCancel}
      />
    </>
  );
};