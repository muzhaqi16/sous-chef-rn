import { bindLocalWrite } from '#apollo/pendingWrites/bindLocalWrite';
import { entityFields } from '#apollo/pendingWrites/entityFields';
import {
  addRows,
  createList,
  moveToPantry,
  removeList,
  removeRows,
  updateRow,
} from '#entities/shoppingList/localWrites';
import {
  AddItemToShoppingListDocument,
  CancelRecurringDocument,
  CompleteShoppingListDocument,
  CreateRecurringShoppingListDocument,
  CreateShoppingListDocument,
  DeleteShoppingListDocument,
  DeleteShoppingListReminderDocument,
  MarkAsTemplateDocument,
  MarkShoppingListActiveDocument,
  MarkShoppingListAsDefaultDocument,
  MoveShoppingItemToPantryDocument,
  RemoveItemFromShoppingListDocument,
  RemoveItemsFromShoppingListDocument,
  UpdateShoppingListDocument,
  UpdateShoppingListItemDocument,
  UpdateShoppingListReminderDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';

// Each document this feature sends as a local write, bound to its write.
export const addItemToShoppingListWrite = bindLocalWrite(
  AddItemToShoppingListDocument,
  { ...addRows, subject: { key: 'items', mints: true } },
);
export const createShoppingListWrite = bindLocalWrite(
  CreateShoppingListDocument,
  createList,
);
export const deleteShoppingListWrite = bindLocalWrite(
  DeleteShoppingListDocument,
  removeList,
);
export const updateShoppingListItemWrite = bindLocalWrite(
  UpdateShoppingListItemDocument,
  updateRow,
);
export const removeItemFromShoppingListWrite = bindLocalWrite(
  RemoveItemFromShoppingListDocument,
  { ...removeRows, subject: { deletes: true } },
);
export const removeItemsFromShoppingListWrite = bindLocalWrite(
  RemoveItemsFromShoppingListDocument,
  { ...removeRows, subject: { key: 'ids', deletes: true } },
);
export const updateShoppingListWrite = bindLocalWrite(
  UpdateShoppingListDocument,
  entityFields,
);
export const completeShoppingListWrite = bindLocalWrite(
  CompleteShoppingListDocument,
  entityFields,
);
export const markShoppingListActiveWrite = bindLocalWrite(
  MarkShoppingListActiveDocument,
  entityFields,
);
export const markShoppingListAsDefaultWrite = bindLocalWrite(
  MarkShoppingListAsDefaultDocument,
  entityFields,
);
export const markAsTemplateWrite = bindLocalWrite(
  MarkAsTemplateDocument,
  entityFields,
);
export const createRecurringShoppingListWrite = bindLocalWrite(
  CreateRecurringShoppingListDocument,
  entityFields,
);
export const cancelRecurringWrite = bindLocalWrite(
  CancelRecurringDocument,
  entityFields,
);
export const updateShoppingListReminderWrite = bindLocalWrite(
  UpdateShoppingListReminderDocument,
  entityFields,
);
export const deleteShoppingListReminderWrite = bindLocalWrite(
  DeleteShoppingListReminderDocument,
  entityFields,
);
export const moveShoppingItemToPantryWrite = bindLocalWrite(
  MoveShoppingItemToPantryDocument,
  { ...moveToPantry, subject: { key: 'pantryItemId', mints: true } },
);
