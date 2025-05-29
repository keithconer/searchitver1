"use client";

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
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
  bluetoothOff?: boolean; // <-- Add this prop if you want to trigger disconnect modal from HomeScreen
}

const getSignalStrength = (rssi: number | null) => {
  if (rssi === null) return "searching for signal...";
  return `${rssi} dBm`;
};

const getSignalColor = (rssi: number | null) => {
  if (rssi === null) return "#999";
  if (rssi > -60) return "#00c853"; // Green
  if (rssi > -75) return "#ffd600"; // Yellow
  if (rssi > -90) return "#ff9100"; // Orange
  return "#999";
};

export default function SearchActions({
  object,
  rssi,
  onBack,
  connectedDevice,
  bluetoothOff = false,
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

        // If RSSI is very weak or null, consider as disconnected
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

  // Show disconnect modal if bluetooth is off
  useEffect(() => {
    if (bluetoothOff) setDisconnectModalVisible(true);
  }, [bluetoothOff]);

  // Animate RSSI value
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

  // Logo import path - adjust as needed!
  let logoSrc;
  try {
    logoSrc = require("../../imgs/logo.png"); // For app/ folder
  } catch (e) {
    try {
      logoSrc = require("@/imgs/logo.png"); // For expo-router alias
    } catch (e) {
      logoSrc = null;
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Logo & Heading */}
      <View style={styles.topSection}>
        {logoSrc && (
          <Image source={logoSrc} style={styles.logo} resizeMode="contain" />
        )}
        <Text style={styles.heading}>search it.</Text>
      </View>

      {/* Centered Object Name & Signal */}
      <View style={styles.centeredContent}>
        <Animated.Text style={[styles.objectName, { opacity }]}>
          {object.name}
        </Animated.Text>
        <Animated.Text
          style={[
            styles.rssiText,
            {
              color: getSignalColor(currentRssi),
              opacity,
            },
          ]}
        >
          {currentRssi !== null
            ? getSignalStrength(currentRssi)
            : "searching for signal..."}
        </Animated.Text>
      </View>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleBuzzerPress}
        >
          <Ionicons name="volume-high" size={32} color="#247eff" />
          <Text style={styles.actionLabel}>Buzzer</Text>
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
  topSection: {
    alignItems: "center",
    marginTop: 30,
    marginBottom: 10,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 0,
  },
  heading: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#247eff",
    marginTop: 0,
    marginBottom: 18,
    fontFamily: "System",
  },
  centeredContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  objectName: {
    color: "#247eff",
    fontWeight: "bold",
    fontSize: 36,
    marginBottom: 16,
    textAlign: "center",
  },
  rssiText: {
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
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
    fontSize: 17,
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
