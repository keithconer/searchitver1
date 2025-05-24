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
  if (rssi >= -50) return "Very Near";
  if (rssi >= -63) return "Near";
  if (rssi >= -75) return "Far";
  return "Very Far";
};

const getSignalColor = (rssi: number | null) => {
  if (rssi === null) return "#999";
  if (rssi >= -50) return "#00ff00"; // Green for very near
  if (rssi >= -63) return "#247eff"; // Blue for near
  if (rssi >= -75) return "#ffbb00"; // Yellow for far
  return "#ff3b30"; // Red for very far
};

export default function SearchActions({
  object,
  rssi,
  onBack,
  connectedDevice,
}: SearchActionsProps) {
  const signalStrength = getSignalStrength(rssi);
  const signalColor = getSignalColor(rssi);

  // Animation for blinking RSSI - using the working approach from reference
  const opacity = useRef(new Animated.Value(1)).current;
  const [currentRssi, setCurrentRssi] = useState(rssi);
  const [disconnectModalVisible, setDisconnectModalVisible] = useState(false);

  // Real-time RSSI monitoring using the working approach
  useEffect(() => {
    if (!connectedDevice) return;

    const updateRSSI = async () => {
      try {
        const updatedDevice = await connectedDevice.readRSSI();
        const rssiValue = updatedDevice.rssi;

        if (typeof rssiValue === "number") {
          setCurrentRssi(rssiValue);
        }
      } catch (error) {
        console.error("Error reading RSSI:", error);
        // Handle disconnection
        setDisconnectModalVisible(true);
      }
    };

    const interval = setInterval(updateRSSI, 1000);
    return () => clearInterval(interval);
  }, [connectedDevice]);

  // Radar blinking effect - using the working animation approach
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

  const handleBuzzerPress = async () => {
    console.log("Buzzer pressed for", object.name);
    if (connectedDevice) {
      try {
        // TODO: Write to ESP32 characteristic to trigger buzzer
        // const services = await connectedDevice.services()
        // Find the correct service and characteristic for buzzer control
      } catch (error) {
        console.log("Buzzer command error:", error);
      }
    }
  };

  const handleLightPress = async () => {
    console.log("Light pressed for", object.name);
    if (connectedDevice) {
      try {
        // TODO: Write to ESP32 characteristic to trigger light
        // const services = await connectedDevice.services()
        // Find the correct service and characteristic for light control
      } catch (error) {
        console.log("Light command error:", error);
      }
    }
  };

  const handleDisconnectModalClose = () => {
    setDisconnectModalVisible(false);
    onBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#247eff" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerText}>Search Actions</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.description}>
          You may now perform search actions.
        </Text>

        <View style={styles.objectInfo}>
          <Text style={styles.objectTitle}>
            <Text style={styles.objectNameBlue}>Your {object.name}</Text>
            <Text style={styles.objectNameGray}> - </Text>
          </Text>
        </View>

        {/* RSSI Display with Animation - using working approach */}
        <Animated.View style={[styles.rssiContainer, { opacity }]}>
          <Text style={styles.rssiLabel}>
            {currentRssi !== null ? (
              <>
                <Text style={[styles.rssiValue, { color: signalColor }]}>
                  {currentRssi} dBm
                </Text>
                <Text style={[styles.rssiStrength, { color: signalColor }]}>
                  {" "}
                  ({getSignalStrength(currentRssi)})
                </Text>
              </>
            ) : (
              <Text style={styles.searchingText}>searching for signal...</Text>
            )}
          </Text>

          {/* Connection Status */}
          <View style={styles.connectionStatus}>
            <View
              style={[
                styles.connectionDot,
                { backgroundColor: connectedDevice ? "#00ff00" : "#ff3b30" },
              ]}
            />
            <Text style={styles.connectionText}>
              {connectedDevice ? "Connected" : "Disconnected"}
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Bottom Action Buttons */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleBuzzerPress}
        >
          <Ionicons name="volume-high" size={24} color="#247eff" />
          <Text style={styles.actionButtonText}>Buzzer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleLightPress}
        >
          <Ionicons name="flash" size={24} color="#247eff" />
          <Text style={styles.actionButtonText}>Light</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>Search It, 2025. All Rights Reserved.</Text>

      {/* Disconnection Modal - using the working modal from reference */}
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    alignItems: "center",
  },
  headerText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#247eff",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  description: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    marginBottom: 40,
  },
  objectInfo: {
    alignItems: "center",
    marginBottom: 20,
  },
  objectTitle: {
    fontSize: 20,
    textAlign: "center",
    lineHeight: 28,
  },
  objectNameBlue: {
    color: "#247eff",
    fontWeight: "bold",
  },
  objectNameGray: {
    color: "#666",
  },
  rssiContainer: {
    alignItems: "center",
    marginVertical: 20,
    padding: 15,
    backgroundColor: "#F0F8FF",
    borderRadius: 10,
    width: "100%",
  },
  rssiLabel: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 10,
  },
  rssiValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  rssiStrength: {
    fontSize: 16,
  },
  searchingText: {
    fontSize: 16,
    color: "#999",
    fontStyle: "italic",
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 14,
    color: "#666",
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 60,
    paddingVertical: 30,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  actionButton: {
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 25,
  },
  actionButtonText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "500",
    color: "#247eff",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#999",
    marginBottom: 20,
  },
  // Modal styles from working reference
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
