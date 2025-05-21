import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const [showForm, setShowForm] = useState(false);
  const [selectedTag, setSelectedTag] = useState();

  return (
    <SafeAreaView style={styles.container}>
      {!showForm ? (
        <View style={styles.centered}>
          <Image
            source={require("@/assets/imgs/logo.png")}
            style={styles.logo}
          />
          <Text style={styles.heading}>search it.</Text>
          <Text style={styles.subheading}>
            You can add 3 specific objects to monitor
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowForm(true)}
          >
            <Text style={styles.addButtonText}>+ Add Object</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.formContainer}>
          <Text style={styles.title}>Add Object (0/3)</Text>

          <Text style={styles.label}>Object name</Text>
          <TextInput placeholder="Wallet" style={styles.input} />

          <Text style={styles.label}>Description</Text>
          <TextInput
            placeholder="Write a very short description where you usually place this object."
            multiline
            style={[styles.input, { height: 60 }]}
          />

          <Text style={styles.label}>Assign Tag</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedTag}
              onValueChange={(itemValue) => setSelectedTag(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="(dropdown values; tags)" value={null} />
              <Picker.Item label="Keys" value="keys" />
              <Picker.Item label="Wallet" value="wallet" />
              <Picker.Item label="Bag" value="bag" />
            </Picker>
          </View>

          <Text style={styles.label}>Set Password</Text>
          <View style={styles.passwordField}>
            <Ionicons name="eye-off" size={18} color="#999" />
            <TextInput
              placeholder="(maximum of 6 characters)"
              maxLength={6}
              secureTextEntry
              style={styles.passwordInput}
            />
          </View>

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput secureTextEntry style={styles.input} />

          <TouchableOpacity style={styles.confirmButton}>
            <Text style={styles.confirmButtonText}>✔ Confirm Object</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={styles.footer}>Search It, 2025. All Rights Reserved.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  logo: { width: 80, height: 80, resizeMode: "contain", marginBottom: 10 },
  heading: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#247eff",
    marginBottom: 10,
  },
  subheading: {
    fontSize: 16,
    color: "#333",
    marginBottom: 30,
    textAlign: "center",
  },
  addButton: { backgroundColor: "#247eff", padding: 15, borderRadius: 8 },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  formContainer: { flex: 1 },
  title: {
    color: "#247eff",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  label: { fontWeight: "bold", marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: "#f2f2f2", borderRadius: 6, padding: 10 },
  pickerWrapper: { backgroundColor: "#f2f2f2", borderRadius: 6 },
  picker: { height: 50 },
  passwordField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f2f2",
    borderRadius: 6,
    paddingHorizontal: 10,
  },
  passwordInput: { flex: 1, padding: 10 },
  confirmButton: {
    backgroundColor: "#247eff",
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    alignItems: "center",
  },
  confirmButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#999",
    marginBottom: 10,
  },
});
