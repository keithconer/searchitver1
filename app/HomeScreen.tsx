import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import React, { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TAGS = [
  { label: "ESP32 C3mini (Tag 1)", value: "tag1" },
  { label: "ESP32 Wroom (Tag 2)", value: "tag2" },
  { label: "ESP32 CAM (Tag 3)", value: "tag3" },
];

const STORAGE_KEY = "@searchit_objects";

export default function HomeScreen() {
  const [showForm, setShowForm] = useState(false);
  const [objects, setObjects] = useState<any[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMsg, setModalMsg] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Load saved objects from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) setObjects(JSON.parse(data));
    })();
  }, []);

  // Dynamically filter available tags (exclude already-assigned ones)
  const availableTags = TAGS.filter(
    (tag) => !objects.find((obj) => obj.tag === tag.value)
  );

  // Form validation logic
  const validate = () => {
    let err: { [key: string]: string } = {};
    if (!name.trim()) err.name = "Object name is required";
    if (!selectedTag) err.tag = "Tag is required";
    if (!password) err.password = "Password is required";
    if (password.length < 1 || password.length > 6)
      err.password = "Password must be 1-6 characters";
    if (!confirm) err.confirm = "Confirm password is required";
    if (confirm !== password) err.confirm = "Passwords do not match";
    return err;
  };

  // Handle confirm object
  const onConfirm = async () => {
    const err = validate();
    setErrors(err);
    if (Object.keys(err).length > 0) return;

    const obj = {
      name: name.trim(),
      description: description.trim(),
      tag: selectedTag,
      password,
    };
    const updated = [...objects, obj];
    setObjects(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setModalMsg("Object added successfully!");
    setModalVisible(true);
    setName("");
    setDescription("");
    setSelectedTag(null);
    setPassword("");
    setConfirm("");
    setTimeout(() => setModalVisible(false), 1800);
  };

  // Handle showing the form and clearing errors/input
  const handleShowForm = () => {
    setShowForm(true);
    setErrors({});
    setName("");
    setDescription("");
    setSelectedTag(null);
    setPassword("");
    setConfirm("");
  };

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
            onPress={handleShowForm}
            disabled={objects.length >= 3}
          >
            <Text style={styles.addButtonText}>+ Add Object</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.formContainer}>
          <Text style={styles.title}>Add Object ({objects.length}/3)</Text>

          <Text style={styles.label}>
            Object name <Text style={{ color: "red" }}>*</Text>
          </Text>
          <TextInput
            placeholder="Wallet"
            style={[
              styles.input,
              errors.name && { borderColor: "red", borderWidth: 1 },
            ]}
            value={name}
            onChangeText={setName}
          />
          {errors.name && <Text style={styles.err}>{errors.name}</Text>}

          <Text style={styles.label}>Description</Text>
          <TextInput
            placeholder="Write a very short description where you usually place this object."
            multiline
            style={[styles.input, { height: 60 }]}
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.label}>
            Assign Tag <Text style={{ color: "red" }}>*</Text>
          </Text>
          <View
            style={[
              styles.pickerWrapper,
              errors.tag && { borderColor: "red", borderWidth: 1 },
            ]}
          >
            <Picker
              selectedValue={selectedTag}
              onValueChange={(itemValue) => setSelectedTag(itemValue)}
              style={styles.picker}
              enabled={availableTags.length > 0}
            >
              <Picker.Item label="Select tag..." value={null} />
              {availableTags.map((tag) => (
                <Picker.Item
                  key={tag.value}
                  label={tag.label}
                  value={tag.value}
                />
              ))}
            </Picker>
          </View>
          {errors.tag && <Text style={styles.err}>{errors.tag}</Text>}

          <Text style={styles.label}>
            Set Password <Text style={{ color: "red" }}>*</Text>
          </Text>
          <View
            style={[
              styles.passwordField,
              errors.password && { borderColor: "red", borderWidth: 1 },
            ]}
          >
            <Pressable onPress={() => setPasswordVisible((v) => !v)}>
              <Ionicons
                name={passwordVisible ? "eye" : "eye-off"}
                size={18}
                color="#999"
              />
            </Pressable>
            <TextInput
              placeholder="(maximum of 6 characters)"
              maxLength={6}
              secureTextEntry={!passwordVisible}
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
            />
          </View>
          {errors.password && <Text style={styles.err}>{errors.password}</Text>}

          <Text style={styles.label}>
            Confirm Password <Text style={{ color: "red" }}>*</Text>
          </Text>
          <View
            style={[
              styles.passwordField,
              errors.confirm && { borderColor: "red", borderWidth: 1 },
            ]}
          >
            <Pressable
              onPress={() => setConfirmPasswordVisible((v) => !v)}
              disabled={password.length === 0}
            >
              <Ionicons
                name={confirmPasswordVisible ? "eye" : "eye-off"}
                size={18}
                color={password.length === 0 ? "#ccc" : "#999"}
              />
            </Pressable>
            <TextInput
              placeholder=""
              secureTextEntry={!confirmPasswordVisible}
              style={styles.passwordInput}
              value={confirm}
              onChangeText={setConfirm}
              editable={password.length > 0}
            />
          </View>
          {errors.confirm && <Text style={styles.err}>{errors.confirm}</Text>}

          <TouchableOpacity
            style={[
              styles.confirmButton,
              objects.length >= 3 && { backgroundColor: "#ccc" },
            ]}
            onPress={onConfirm}
            disabled={objects.length >= 3}
          >
            <Text style={styles.confirmButtonText}>✔ Confirm Object</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={48} color="#247eff" />
            <Text style={styles.modalText}>{modalMsg}</Text>
          </View>
        </View>
      </Modal>

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
  addButton: {
    backgroundColor: "#247eff",
    padding: 15,
    borderRadius: 8,
    width: 200,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
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
  err: { color: "red", fontSize: 12, marginVertical: 2 },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#999",
    marginBottom: 10,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 30,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  modalText: {
    marginTop: 18,
    fontSize: 18,
    color: "#247eff",
    fontWeight: "bold",
    textAlign: "center",
  },
});
