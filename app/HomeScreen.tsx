import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BleManager, State as BleState, Device } from "react-native-ble-plx";
import { SafeAreaView } from "react-native-safe-area-context";

const TAGS = [
  { label: "ESP32 C3mini (Tag 1)", value: "tag1" },
  { label: "ESP32 Wroom (Tag 2)", value: "tag2" },
  { label: "ESP32 CAM (Tag 3)", value: "tag3" },
];

const TAG_MAC_PATTERNS = {
  tag1: "6E:",
  tag2: "33:",
  tag3: "5E:",
};

const STORAGE_KEY = "@searchit_objects";
const SETUP_DONE_KEY = "@searchit_setup_done";

const getSignalIcon = (rssi: number | null, bluetoothOff: boolean = false) => {
  if (bluetoothOff || rssi === null)
    return { icon: "warning-outline", color: "#ff3b30", label: "n/a" };
  if (rssi >= -40)
    return { icon: "cellular", color: "#247eff", label: "very near" };
  if (rssi >= -60)
    return { icon: "cellular-outline", color: "#ffbb00", label: "far" };
  return { icon: "cellular-outline", color: "#ffbb00", label: "far" };
};

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS === "android") {
    try {
      if (Platform.Version >= 31) {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];

        const granted = await PermissionsAndroid.requestMultiple(permissions);

        const allGranted = Object.values(granted).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            "Permissions Required",
            "Bluetooth and Location permissions are needed for BLE scanning. Please enable them in your phone settings.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Open Settings",
                onPress: () => {
                  Alert.alert(
                    "Please open settings and enable all permissions for this app"
                  );
                },
              },
            ]
          );
          return false;
        }
        return true;
      } else if (Platform.Version >= 23) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message:
              "This app needs access to your location to scan for BLE devices",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          }
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            "Permission Denied",
            "Location permission is required for BLE scanning"
          );
          return false;
        }
        return true;
      }
      return true;
    } catch (err) {
      console.error("Permission request error:", err);
      Alert.alert(
        "Permission Error",
        "Could not request Bluetooth/Location permissions."
      );
      return false;
    }
  }
  return true;
}

type ObjectType = {
  name: string;
  description: string;
  tag: string;
  password: string;
  deviceId?: string;
};

export default function HomeScreen() {
  const [showForm, setShowForm] = useState(false);
  const [objects, setObjects] = useState<ObjectType[]>([]);
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
  const [setupDone, setSetupDone] = useState(false);

  const [rssiMap, setRssiMap] = useState<{ [tag: string]: number | null }>({});
  const [bluetoothOff, setBluetoothOff] = useState(false);
  const bleManager = useRef<BleManager | null>(null);

  const [foundDevices, setFoundDevices] = useState<Device[]>([]);
  const [devicePickerVisible, setDevicePickerVisible] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);

  // --- ADDED: refs for each TextInput for focus fix ---
  const nameRef = useRef<TextInput>(null);
  const descRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  useEffect(() => {
    const requestPermissions = async () => {
      const permissionsGranted = await requestBlePermissions();
      if (!permissionsGranted) {
        Alert.alert(
          "Permissions Required",
          "This app requires Bluetooth and Location permissions to function properly. Please grant these permissions in your device settings."
        );
      }
    };

    requestPermissions();
  }, []);

  useEffect(() => {
    (async () => {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) setObjects(JSON.parse(data));
      const done = await AsyncStorage.getItem(SETUP_DONE_KEY);
      setSetupDone(!!done);
    })();
  }, []);

  useEffect(() => {
    if (objects.length === 3 && !setupDone) {
      AsyncStorage.setItem(SETUP_DONE_KEY, "true");
      setSetupDone(true);
    }
  }, [objects, setupDone]);

  const getTagForDevice = (deviceId: string): string | null => {
    const exactMatch = objects.find((obj) => obj.deviceId === deviceId);
    if (exactMatch) {
      return exactMatch.tag;
    }
    for (const [tag, pattern] of Object.entries(TAG_MAC_PATTERNS)) {
      if (deviceId.startsWith(pattern)) {
        return tag;
      }
    }
    return null;
  };

  useEffect(() => {
    if (!setupDone || objects.length < 3) return;

    bleManager.current = new BleManager();
    let scanActive = false;

    const stateSubscription = bleManager.current.onStateChange((state) => {
      if (state === BleState.PoweredOff) {
        setBluetoothOff(true);
        setRssiMap(Object.fromEntries(objects.map((obj) => [obj.tag, null])));
        bleManager.current && bleManager.current.stopDeviceScan();
        scanActive = false;
      } else if (state === BleState.PoweredOn) {
        setBluetoothOff(false);
        if (!scanActive) {
          startBleScan();
        }
      }
    }, true);

    async function startBleScan() {
      const perms = await requestBlePermissions();
      if (!perms) return;

      const initialRssiMap = Object.fromEntries(
        objects.map((obj) => [obj.tag, null])
      );
      setRssiMap(initialRssiMap);

      scanActive = true;

      bleManager.current!.startDeviceScan(
        null,
        { allowDuplicates: true },
        (error, device) => {
          if (error) {
            if (error.errorCode === 102 || error.errorCode === 201) {
              setBluetoothOff(true);
              setRssiMap(initialRssiMap);
            }
            return;
          }

          if (!device || !device.id) return;

          const matchedTag = getTagForDevice(device.id);

          if (matchedTag) {
            setRssiMap((prev) => ({
              ...prev,
              [matchedTag]: device.rssi,
            }));
          }
        }
      );
    }

    startBleScan();

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === "active") {
        if (!bluetoothOff) startBleScan();
      } else if (nextAppState.match(/inactive|background/)) {
        bleManager.current && bleManager.current.stopDeviceScan();
      }
    };
    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      bleManager.current && bleManager.current.stopDeviceScan();
      bleManager.current && bleManager.current.destroy();
      appStateSubscription && appStateSubscription.remove();
      stateSubscription && stateSubscription.remove();
    };
  }, [setupDone, objects.length, objects]);

  // --- FIX: always reset all refs and their values after adding an object ---
  // We also focus the first field after showing the form
  const resetForm = () => {
    setErrors({});
    setName("");
    setDescription("");
    setSelectedTag(null);
    setPassword("");
    setConfirm("");
    setPasswordVisible(false);
    setConfirmPasswordVisible(false);

    // Timeout: wait for state update, then focus
    setTimeout(() => {
      nameRef.current?.focus();
    }, 100);
  };

  if (!setupDone || objects.length < 3) {
    const availableTags = TAGS.filter(
      (tag) => !objects.find((obj) => obj.tag === tag.value)
    );

    const showDevicePicker = async () => {
      const permissionsGranted = await requestBlePermissions();
      if (!permissionsGranted) {
        Alert.alert(
          "Permissions Required",
          "Bluetooth and Location permissions are needed to scan for devices."
        );
        return;
      }

      setFoundDevices([]);
      setDevicePickerVisible(true);
      setPickerLoading(true);

      let scanned: { [id: string]: Device } = {};
      let timer: NodeJS.Timeout;

      if (bleManager.current) {
        bleManager.current.stopDeviceScan();
      } else {
        bleManager.current = new BleManager();
      }

      bleManager.current.startDeviceScan(
        null,
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            setPickerLoading(false);
            bleManager.current?.stopDeviceScan();
            clearTimeout(timer);
            return;
          }
          if (!device || !device.id) return;
          if (typeof device.rssi === "number" && !scanned[device.id]) {
            scanned[device.id] = device;
            setFoundDevices((prev) => [...prev, device]);
          }
        }
      );
      timer = setTimeout(() => {
        setPickerLoading(false);
        bleManager.current?.stopDeviceScan();
      }, 6000);
    };

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

    const onDevicePick = async (device: Device) => {
      setDevicePickerVisible(false);

      const deviceId = device.id;

      if (selectedTag && selectedTag in TAG_MAC_PATTERNS) {
        const pattern = deviceId.substring(0, 3);
        // @ts-ignore
        TAG_MAC_PATTERNS[selectedTag] = pattern;
      }

      const obj: ObjectType = {
        name: name.trim(),
        description: description.trim(),
        tag: selectedTag!,
        password,
        deviceId: deviceId,
      };

      const updated = [...objects, obj];
      setObjects(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setModalMsg("Object added successfully!");
      setModalVisible(true);

      // --- FIX: call resetForm after adding an object, and reopen form for next ---
      resetForm();
      setShowForm(true);

      setTimeout(() => setModalVisible(false), 1800);
    };

    const onConfirm = async () => {
      const err = validate();
      setErrors(err);
      if (Object.keys(err).length > 0) return;
      showDevicePicker();
    };

    const handleShowForm = () => {
      setShowForm(true);
      resetForm();
    };

    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
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
                <Text style={styles.title}>
                  Add Object ({objects.length}/3)
                </Text>
                <Text style={styles.label}>
                  Object name <Text style={{ color: "red" }}>*</Text>
                </Text>
                <TextInput
                  ref={nameRef}
                  placeholder="Wallet"
                  placeholderTextColor="#888"
                  style={[
                    styles.input,
                    errors.name && { borderColor: "red", borderWidth: 1 },
                  ]}
                  value={name}
                  onChangeText={setName}
                  editable={true}
                  returnKeyType="next"
                  onSubmitEditing={() => descRef.current?.focus()}
                />
                {errors.name && <Text style={styles.err}>{errors.name}</Text>}
                <Text style={styles.label}>Description</Text>
                <TextInput
                  ref={descRef}
                  placeholder="Write a very short description where you usually place this object."
                  placeholderTextColor="#888"
                  multiline
                  style={[styles.input, { height: 60 }]}
                  value={description}
                  onChangeText={setDescription}
                  editable={true}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
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
                    style={[
                      styles.picker,
                      { color: "#000", backgroundColor: "#fff" },
                    ]}
                    enabled={availableTags.length > 0}
                    dropdownIconColor="#000"
                    itemStyle={{ color: "#000", backgroundColor: "#fff" }}
                  >
                    <Picker.Item
                      label="Select tag..."
                      value={null}
                      color="#000"
                    />
                    {availableTags.map((tag) => (
                      <Picker.Item
                        key={tag.value}
                        label={tag.label}
                        value={tag.value}
                        color="#000"
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
                    ref={passwordRef}
                    placeholder="(maximum of 6 characters)"
                    placeholderTextColor="#888"
                    maxLength={6}
                    secureTextEntry={!passwordVisible}
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    editable={true}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                  />
                </View>
                {errors.password && (
                  <Text style={styles.err}>{errors.password}</Text>
                )}
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
                    ref={confirmRef}
                    placeholder=""
                    placeholderTextColor="#888"
                    secureTextEntry={!confirmPasswordVisible}
                    style={styles.passwordInput}
                    value={confirm}
                    onChangeText={setConfirm}
                    editable={password.length > 0}
                  />
                </View>
                {errors.confirm && (
                  <Text style={styles.err}>{errors.confirm}</Text>
                )}
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
            <View style={{ height: 20 }} />
          </ScrollView>
          <Text style={styles.footer}>
            Search It, 2025. All Rights Reserved.
          </Text>
        </KeyboardAvoidingView>
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
        <Modal
          visible={devicePickerVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setDevicePickerVisible(false)}
        >
          <View style={styles.devicePickerBg}>
            <View style={styles.devicePickerContainer}>
              <Text style={styles.pickerTitle}>
                Select the correct BLE device for this object
              </Text>
              {pickerLoading ? (
                <Text style={styles.pickerLoading}>
                  Scanning nearby devices...
                </Text>
              ) : foundDevices.length === 0 ? (
                <Text style={styles.pickerLoading}>
                  No devices found. Try again.
                </Text>
              ) : (
                <FlatList
                  data={foundDevices}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.deviceItem}
                      onPress={() => onDevicePick(item)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "bold" }}>
                          {item.name || item.localName || "Unnamed"}
                        </Text>
                        <Text style={{ fontSize: 13, color: "#666" }}>
                          {item.id}
                        </Text>
                      </View>
                      <Text style={{ fontWeight: "bold", color: "#247eff" }}>
                        RSSI: {item.rssi}
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListFooterComponent={
                    <TouchableOpacity
                      style={styles.rescanButton}
                      onPress={() => {
                        setFoundDevices([]);
                        setPickerLoading(true);
                        if (bleManager.current)
                          bleManager.current.stopDeviceScan();
                        showDevicePicker();
                      }}
                    >
                      <Ionicons name="refresh" size={18} color="#247eff" />
                      <Text style={{ color: "#247eff", marginLeft: 6 }}>
                        Scan again
                      </Text>
                    </TouchableOpacity>
                  }
                />
              )}
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setDevicePickerVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.containerNoPad}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.centeredTop}>
          <Image
            source={require("@/assets/imgs/logo.png")}
            style={styles.logo}
          />
          <Text style={styles.heading}>search it.</Text>
        </View>
        <Text style={styles.selectLabel}>Select Object</Text>
        <View style={styles.objectListWrapper}>
          {objects.map((obj, idx) => {
            const rssi = obj.tag in rssiMap ? rssiMap[obj.tag] : null;
            const signal = getSignalIcon(rssi, bluetoothOff);
            return (
              <View style={styles.objectItem} key={obj.tag}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.objectName}>{obj.name}</Text>
                  <Text style={styles.objectDesc}>{obj.description}</Text>
                  <Text style={styles.deviceIdLabel}>
                    {obj.deviceId
                      ? `Device: ${obj.deviceId}`
                      : "No device assigned"}
                  </Text>
                </View>
                <View style={styles.signalSection}>
                  <Text
                    style={[
                      styles.signalValue,
                      { color: signal.color },
                      (rssi === null || bluetoothOff) && {
                        color: signal.color,
                      },
                    ]}
                  >
                    {rssi !== null && !bluetoothOff ? `${rssi}` : "n/a"}
                  </Text>
                  <Text
                    style={[
                      styles.signalLabel,
                      { color: signal.color },
                      (rssi === null || bluetoothOff) && {
                        color: signal.color,
                      },
                    ]}
                  >
                    {rssi !== null && !bluetoothOff ? `(${signal.label})` : ""}
                  </Text>
                </View>
                <Ionicons
                  name={signal.icon as any}
                  size={22}
                  color={signal.color}
                  style={{ marginHorizontal: 4 }}
                />
                <Ionicons name="ellipsis-horizontal" size={22} color="#666" />
              </View>
            );
          })}
        </View>
        <View style={{ flex: 1 }} />
        <Text style={styles.footer}>Search It, 2025. All Rights Reserved.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  containerNoPad: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  centeredTop: { alignItems: "center", marginTop: 36, marginBottom: 10 },
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
  selectLabel: {
    fontSize: 17,
    fontWeight: "500",
    marginHorizontal: 30,
    marginBottom: 6,
    color: "#555",
  },
  objectListWrapper: {
    backgroundColor: "#f8f6f5",
    marginHorizontal: 0,
    borderRadius: 6,
    paddingVertical: 2,
    marginBottom: 12,
    borderColor: "#ececec",
    borderWidth: 1,
    elevation: 1,
  },
  objectItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderBottomColor: "#e0dede",
    borderBottomWidth: 1,
  },
  objectName: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#222",
  },
  objectDesc: {
    color: "#999",
    fontSize: 14,
    marginTop: 2,
  },
  deviceIdLabel: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
  },
  signalSection: {
    minWidth: 72,
    alignItems: "flex-end",
    marginRight: 10,
  },
  signalValue: {
    fontWeight: "bold",
    fontSize: 15,
  },
  signalLabel: {
    fontSize: 13,
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
  label: { fontWeight: "bold", marginBottom: 6, marginTop: 10, color: "#222" },
  input: {
    backgroundColor: "#f2f2f2",
    color: "#222",
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 6,
    fontSize: 16,
  },
  pickerWrapper: {
    backgroundColor: "#f2f2f2",
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  picker: { height: 50, color: "#000", backgroundColor: "#fff" },
  passwordField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f2f2",
    borderRadius: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 6,
  },
  passwordInput: { flex: 1, padding: 10, color: "#222" },
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
  devicePickerBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  devicePickerContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    width: "85%",
    maxHeight: "70%",
    alignItems: "stretch",
  },
  pickerTitle: {
    fontWeight: "bold",
    fontSize: 17,
    color: "#247eff",
    marginBottom: 8,
    textAlign: "center",
  },
  pickerLoading: {
    fontStyle: "italic",
    color: "#888",
    textAlign: "center",
    marginVertical: 24,
  },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f7faff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderColor: "#e1eaff",
    borderWidth: 1,
  },
  rescanButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    padding: 8,
    alignSelf: "center",
    backgroundColor: "#eef5ff",
    borderRadius: 8,
  },
  cancelButton: {
    marginTop: 10,
    alignSelf: "center",
    backgroundColor: "#eee",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: "#888",
    fontWeight: "bold",
    fontSize: 15,
  },
});
