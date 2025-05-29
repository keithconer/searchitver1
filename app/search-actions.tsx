"use client";

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
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
}

const getSignalStrength = (rssi: number | null) => {
  if (rssi === null) return "searching for signal...";
  return `${rssi} dBm`;
};

export default function SearchActions({
  object,
  rssi,
  onBack,
  connectedDevice,
}: SearchActionsProps) {
  // Animation for blinking RSSI (for visual feedback if needed)
  const opacity = useRef(new Animated.Value(1)).current;
  const [currentRssi, setCurrentRssi] = useState(rssi);
  const [disconnectModalVisible, setDisconnectModalVisible] = useState(false);

  // Real-time RSSI monitoring (1s interval)
  useEffect(() => {
    if (!connectedDevice) return;
    const updateRSSI = async () => {
      try {
        const updatedDevice = await connectedDevice.readRSSI();
        const rssiValue = updatedDevice.rssi;
        if (typeof rssiValue === "number") setCurrentRssi(rssiValue);
      } catch (error) {
        setDisconnectModalVisible(true);
      }
    };
    const interval = setInterval(updateRSSI, 1000);
    return () => clearInterval(interval);
  }, [connectedDevice]);

  // Optional: Animate RSSI value
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

  // Placeholder for buzzer/light actions
  const handleBuzzerPress = async () => {};
  const handleLightPress = async () => {};

  const handleDisconnectModalClose = () => {
    setDisconnectModalVisible(false);
    onBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Centered Content */}
      <View style={styles.centeredContent}>
        <Text style={styles.heading}>search it.</Text>
        <Text style={styles.objectLine}>
          <Text style={styles.objectName}>{object.name}</Text>
          <Text style={styles.rssiText}>
            {" "}
            {currentRssi !== null
              ? `[${getSignalStrength(currentRssi)}]`
              : "[searching for signal...]"}
          </Text>
        </Text>
      </View>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleBuzzerPress}
        >
          <Ionicons name="volume-high" size={30} color="#247eff" />
          <Text style={styles.actionLabel}>Buzzer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleLightPress}
        >
          <Ionicons name="flash" size={30} color="#247eff" />
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
              You have been disconnected due to distance limitations, ensure you
              are within the 10-15 meters distance away from the microcontroller
              and keep the bluetooth on.
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
  heading: {
    fontSize: 38,
    fontWeight: "bold",
    color: "#247eff",
    marginBottom: 30,
    fontFamily: "System",
  },
  objectLine: {
    fontSize: 20,
    textAlign: "center",
    fontFamily: "System",
  },
  objectName: {
    color: "#247eff",
    fontWeight: "bold",
    fontSize: 20,
  },
  rssiText: {
    color: "#222",
    fontSize: 17,
    fontFamily: "System",
    fontWeight: "400",
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
  },
  actionLabel: {
    marginTop: 6,
    fontSize: 15,
    color: "#247eff",
    fontWeight: "600",
  },
  // Modal styles
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
