export const INVENTORY_BACKGROUND_ERROR_EVENT = "foxiesdeck:inventory-background-error";

export interface InventoryBackgroundErrorDetail {
  operation: string;
  message: string;
  errorCode?: string;
}
