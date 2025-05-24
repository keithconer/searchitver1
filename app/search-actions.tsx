import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
}

const getSignalStrength = (rssi: number | null) => {
  if (rssi === null) return "n/a";
  if (rssi >= -40) return "very near";
  if (rssi >= -60) return "near";
  return "far";
};

export default function SearchActions({
  object,
  rssi,
  onBack,
}: SearchActionsProps) {
  const signalStrength = getSignalStrength(rssi);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#247eff" />
        </TouchableOpacity>
        <View style={styles.logoContainer}>
          <Image
            source={require("@/assets/imgs/logo.png")}
            style={styles.logo}
          />
          <Text style={styles.heading}>search it.</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.objectInfo}>
          <Text style={styles.objectName}>
            <Text style={styles.objectNameBlue}>{object.name}</Text>
            <Text style={styles.objectNameGray}> [received signal</Text>
          </Text>
          <Text style={styles.objectNameGray}>strength indicator values]</Text>
        </View>

        {/* RSSI Display */}
        <View style={styles.rssiContainer}>
          <Text style={styles.rssiValue}>
            {rssi !== null ? `${rssi} dBm` : "No Signal"}
          </Text>
          <Text style={styles.rssiLabel}>
            {rssi !== null ? `(${signalStrength})` : ""}
          </Text>
        </View>
      </View>

      {/* Bottom Action Buttons */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="volume-high" size={32} color="#247eff" />
          <Text style={styles.actionButtonText}>Buzzer</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="flash" size={32} color="#247eff" />
          <Text style={styles.actionButtonText}>Light</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>Search It, 2025. All Rights Reserved.</Text>
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
  logoContainer: {
    alignItems: "center",
    flex: 1,
  },
  logo: {
    width: 60,
    height: 60,
    resizeMode: "contain",
    marginBottom: 5,
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#247eff",
  },
  placeholder: {
    width: 40, // Same width as back button to center the logo
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  objectInfo: {
    alignItems: "center",
    marginBottom: 40,
  },
  objectName: {
    fontSize: 18,
    textAlign: "center",
    lineHeight: 24,
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
  },
  rssiValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#247eff",
    marginBottom: 5,
  },
  rssiLabel: {
    fontSize: 16,
    color: "#666",
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 40,
    paddingVertical: 30,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  actionButton: {
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 30,
  },
  actionButtonText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "500",
    color: "#247eff",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#999",
    marginBottom: 20,
  },
});
