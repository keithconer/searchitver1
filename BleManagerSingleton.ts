import { BleManager } from "react-native-ble-plx";

let bleManager: BleManager | null = null;

export function getBleManager() {
  if (!bleManager) bleManager = new BleManager();
  return bleManager;
}

export function destroyBleManager() {
  if (bleManager) {
    bleManager.destroy();
    bleManager = null;
  }
}