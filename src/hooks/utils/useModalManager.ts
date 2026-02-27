import { useState } from 'react';

export interface ModalManagerResult {
  /**
   * Currently active modal name (null if no modal is open)
   */
  activeModal: string | null;

  /**
   * Open a specific modal by name
   */
  openModal: (modalName: string) => void;

  /**
   * Close the currently active modal
   */
  closeModal: () => void;

  /**
   * Check if a specific modal is currently open
   */
  isOpen: (modalName: string) => boolean;

  /**
   * Toggle a modal (open if closed, close if open)
   */
  toggleModal: (modalName: string) => void;
}

/**
 * useModalManager - Manage multiple modals with a single state variable
 *
 * Replaces the pattern of having multiple boolean states for modals:
 * ```tsx
 * // Before (20+ lines of state):
 * const [addingCuisine, setAddingCuisine] = useState(false);
 * const [editingNutrition, setEditingNutrition] = useState(false);
 * const [addingFavorite, setAddingFavorite] = useState(false);
 * // ... 10+ more modal states
 * ```
 *
 * ```tsx
 * // After (1 line):
 * const { activeModal, openModal, closeModal, isOpen } = useModalManager();
 * ```
 *
 * @example Basic usage
 * ```tsx
 * const { activeModal, openModal, closeModal, isOpen } = useModalManager();
 *
 * // Open a modal
 * <TouchableOpacity onPress={() => openModal('addCuisine')}>
 *   <Text>Add Cuisine</Text>
 * </TouchableOpacity>
 *
 * // Check if modal is open
 * <Modal visible={isOpen('addCuisine')} onRequestClose={closeModal}>
 *   <AddCuisineForm onSave={handleSave} onCancel={closeModal} />
 * </Modal>
 * ```
 *
 * @example With multiple modals
 * ```tsx
 * const modal = useModalManager();
 *
 * return (
 *   <>
 *     <Button onPress={() => modal.openModal('nutrition')}>Edit Nutrition</Button>
 *     <Button onPress={() => modal.openModal('cooking')}>Edit Cooking</Button>
 *     <Button onPress={() => modal.openModal('macros')}>Edit Macros</Button>
 *
 *     <Modal visible={modal.isOpen('nutrition')} onRequestClose={modal.closeModal}>
 *       <NutritionForm />
 *     </Modal>
 *
 *     <Modal visible={modal.isOpen('cooking')} onRequestClose={modal.closeModal}>
 *       <CookingForm />
 *     </Modal>
 *
 *     <Modal visible={modal.isOpen('macros')} onRequestClose={modal.closeModal}>
 *       <MacrosForm />
 *     </Modal>
 *   </>
 * );
 * ```
 *
 * @example With modal names as constants
 * ```tsx
 * const MODALS = {
 *   ADD_CUISINE: 'addCuisine',
 *   EDIT_NUTRITION: 'editNutrition',
 *   ADD_FAVORITE: 'addFavorite',
 * } as const;
 *
 * const modal = useModalManager();
 *
 * <Button onPress={() => modal.openModal(MODALS.ADD_CUISINE)}>Add</Button>
 * <Modal visible={modal.isOpen(MODALS.ADD_CUISINE)}>...</Modal>
 * ```
 */
export function useModalManager(): ModalManagerResult {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const openModal = (modalName: string) => {
    setActiveModal(modalName);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  const isOpen = (modalName: string) => {
      return activeModal === modalName;
    };

  const toggleModal = (modalName: string) => {
      setActiveModal((current) => (current === modalName ? null : modalName));
    };

  return {
    activeModal,
    openModal,
    closeModal,
    isOpen,
    toggleModal };
}
