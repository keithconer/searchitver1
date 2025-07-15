"use client";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Buffer } from "buffer"; // add this import and make sure 'buffer' is installed
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Device } from "react-native-ble-plx";
import { SafeAreaView } from "react-native-safe-area-context";

type ObjectType = {
  name: string;
  description: string;
  tag: string;
  password: string;
  deviceId?: string;
};

interface SearchActionsProps {
  object: ObjectType;
  rssi: number | null;
  onBack: () => void;
  connectedDevice: Device | null;
  bluetoothOff?: boolean;
}

// BLE Service and Characteristic UUIDs
const SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const CHARACTERISTIC_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
const WRITE_CHARACTERISTIC_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";

// Proximity helpers
const getProximity = (rssi: number | null) => {
  if (rssi === null) return "";
  if (rssi >= -55) return "Super Near";
  if (rssi >= -65) return "Near";
  if (rssi >= -80) return "Far";
  return "Super Far";
};

const getSignalColor = (rssi: number | null) => {
  if (rssi === null) return "#bdbdbd"; // Grey
  if (rssi >= -55) return "#00c853"; // Green
  if (rssi >= -65) return "#ffd600"; // Yellow
  if (rssi >= -80) return "#ff9100"; // Orange
  return "#d32f2f"; // Red
};

const getSignalIcon = (rssi: number | null) => {
  if (rssi === null) return "signal-off";
  if (rssi >= -55) return "signal-cellular-3";
  if (rssi >= -65) return "signal-cellular-2";
  if (rssi >= -80) return "signal-cellular-1";
  return "signal-cellular-outline";
};

export default function SearchActions({
  object,
  rssi,
  onBack,
  connectedDevice,
  bluetoothOff = false,
}: SearchActionsProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [currentRssi, setCurrentRssi] = useState(rssi);
  const [disconnectModalVisible, setDisconnectModalVisible] = useState(false);
  const [buzzerState, setBuzzerState] = useState(false);
  const [buzzerLoading, setBuzzerLoading] = useState(false);

  // Real-time RSSI monitoring (1s interval)
  useEffect(() => {
    if (!connectedDevice) return;
    const updateRSSI = async () => {
      try {
        const updatedDevice = await connectedDevice.readRSSI();
        const rssiValue = updatedDevice.rssi;
        if (typeof rssiValue === "number") setCurrentRssi(rssiValue);

        if (rssiValue === null || rssiValue < -90) {
          setDisconnectModalVisible(true);
        }
      } catch (error) {
        setDisconnectModalVisible(true);
      }
    };
    const interval = setInterval(updateRSSI, 1000);
    return () => clearInterval(interval);
  }, [connectedDevice]);

  useEffect(() => {
    if (bluetoothOff) setDisconnectModalVisible(true);
  }, [bluetoothOff]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  // Set up notification listener for buzzer responses
  useEffect(() => {
    if (!connectedDevice) return;

    const setupNotifications = async () => {
      try {
        await connectedDevice.monitorCharacteristicForService(
          SERVICE_UUID,
          CHARACTERISTIC_UUID,
          (error, characteristic) => {
            if (error) {
              console.log("Notification error:", error);
              return;
            }

            if (characteristic?.value) {
              const response = Buffer.from(
                characteristic.value,
                "base64"
              ).toString("utf8");
              console.log("Received response:", response);

              if (response === "BUZZER_ON") {
                setBuzzerState(true);
                setBuzzerLoading(false);
              } else if (response === "BUZZER_OFF") {
                setBuzzerState(false);
                setBuzzerLoading(false);
              }
            }
          }
        );
      } catch (error) {
        console.log("Failed to setup notifications:", error);
      }
    };

    setupNotifications();
  }, [connectedDevice]);

  // BLE command sender for buzzer
  const handleBuzzerPress = async () => {
    if (!connectedDevice) {
      Alert.alert("Error", "Device not connected");
      return;
    }

    setBuzzerLoading(true);

    try {
      const command = "BUZZ_TOGGLE";
      const base64Command = Buffer.from(command, "utf8").toString("base64");

      await connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        WRITE_CHARACTERISTIC_UUID,
        base64Command
      );

      // Loading state will be cleared by the notification response
      // Set a timeout as fallback
      setTimeout(() => {
        setBuzzerLoading(false);
      }, 3000);
    } catch (error) {
      console.log("Buzzer error:", error);
      setBuzzerLoading(false);
      Alert.alert("Error", "Failed to control buzzer");
    }
  };

  // Placeholder for light button
  const handleLightPress = async () => {
    Alert.alert("Light Control", "Light control not implemented yet");
  };

  const handleDisconnectModalClose = () => {
    setDisconnectModalVisible(false);
    setBuzzerState(false); // Reset buzzer state when disconnecting
    onBack();
  };

  // Modern RSSI & Proximity UI
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centeredContent}>
        <Text style={styles.objectName}>{object.name}</Text>
        <View style={styles.signalRow}>
          <MaterialCommunityIcons
            name={getSignalIcon(currentRssi)}
            size={54}
            color={getSignalColor(currentRssi)}
            style={{ marginRight: 10 }}
          />
          <View style={styles.signalTextColumn}>
            <Animated.Text
              style={[
                styles.rssiText,
                { color: getSignalColor(currentRssi), opacity },
              ]}
            >
              {currentRssi !== null ? `${currentRssi} dBm` : "No Signal"}
            </Animated.Text>
            <View
              style={[
                styles.proximityPill,
                { backgroundColor: getSignalColor(currentRssi) + "22" }, // faded background
              ]}
            >
              <Text
                style={[
                  styles.proximityText,
                  { color: getSignalColor(currentRssi) },
                ]}
              >
                {getProximity(currentRssi)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            buzzerState && styles.actionButtonActive,
          ]}
          onPress={handleBuzzerPress}
          disabled={buzzerLoading}
        >
          {buzzerLoading ? (
            <Animated.View style={{ opacity }}>
              <Ionicons name="volume-high" size={32} color="#247eff" />
            </Animated.View>
          ) : (
            <Ionicons
              name={buzzerState ? "volume-high" : "volume-medium"}
              size={32}
              color={buzzerState ? "#ff4444" : "#247eff"}
            />
          )}
          <Text
            style={[
              styles.actionLabel,
              { color: buzzerState ? "#ff4444" : "#247eff" },
            ]}
          >
            {buzzerLoading
              ? "Loading..."
              : buzzerState
              ? "Buzzer ON"
              : "Buzzer"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleLightPress}
        >
          <Ionicons name="flash" size={32} color="#247eff" />
          <Text style={styles.actionLabel}>Light</Text>
        </TouchableOpacity>
      </View>

      {/* Disconnection Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={disconnectModalVisible}
        onRequestClose={handleDisconnectModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="alert-circle" size={50} color="red" />
            <Text style={[styles.modalTitle, { color: "red" }]}>
              Connection Lost
            </Text>
            <Text style={styles.modalText}>
              You have been disconnected due to distance limitations or
              Bluetooth is off. Ensure you are within 10-15 meters from the
              microcontroller and keep the Bluetooth on.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleDisconnectModalClose}
            >
              <Text style={styles.modalButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "space-between",
  },
  centeredContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  objectName: {
    color: "#222",
    fontWeight: "bold",
    fontSize: 34,
    marginBottom: 30,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  signalRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f7f7f8",
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 28,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  signalTextColumn: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  rssiText: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  proximityPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  proximityText: {
    fontSize: 17,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#eaeaea",
    paddingVertical: 18,
    paddingBottom: 26,
    backgroundColor: "#fff",
  },
  actionButton: {
    alignItems: "center",
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionButtonActive: {
    backgroundColor: "#ffebee",
  },
  actionLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "80%",
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#247eff",
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    color: "#333333",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  modalButton: {
    backgroundColor: "#247eff",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
    width: "100%",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
