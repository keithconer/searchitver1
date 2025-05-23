import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
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
import { BleManager, State as BleState } from "react-native-ble-plx";
import DropDownPicker, { ItemType } from "react-native-dropdown-picker";
import { SafeAreaView } from "react-native-safe-area-context";

// Define tag type to match DropDownPicker's ItemType
type TagType = ItemType<string>;

const TAGS: TagType[] = [
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

type ObjectType = {
  name: string;
  description: string;
  tag: string;
  password: string;
  deviceId?: string;
};

export default function HomeScreen() {
  const [objects, setObjects] = useState<ObjectType[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [setupDone, setSetupDone] = useState(false);

  // This state controls whether to show the welcome screen or the form
  const [showForm, setShowForm] = useState(false);

  const [rssiMap, setRssiMap] = useState<{ [tag: string]: number | null }>({});
  const [bluetoothOff, setBluetoothOff] = useState(false);
  const bleManager = useRef<BleManager | null>(null);

  // For permission modals
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [pendingPermissionResolve, setPendingPermissionResolve] = useState<
    ((result: boolean) => void) | null
  >(null);

  // For custom modal (grant)
  const [grantModalVisible, setGrantModalVisible] = useState(false);
  const [pendingGrantResolve, setPendingGrantResolve] = useState<
    ((result: boolean) => void) | null
  >(null);

  // For focus fix
  const nameRef = useRef<TextInput>(null);
  const descRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // For DropDownPicker - fixed TypeScript issues
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagPickerItems, setTagPickerItems] = useState<TagType[]>(TAGS);

  // Custom BLE permission request (returns true if granted)
  async function requestBlePermissionsCustom(): Promise<boolean> {
    if (Platform.OS === "android") {
      // Show custom permission modal first (white bg, black text)
      return await new Promise<boolean>((resolve) => {
        setPermissionModalVisible(true);
        setPendingPermissionResolve(() => resolve);
      });
    }
    return true;
  }

  // Custom grant modal before system permission dialog
  async function showGrantModal(): Promise<boolean> {
    return await new Promise<boolean>((resolve) => {
      setGrantModalVisible(true);
      setPendingGrantResolve(() => resolve);
    });
  }

  async function actuallyRequestPermissions(): Promise<boolean> {
    if (Platform.OS === "android") {
      try {
        // Show custom "Grant permissions" modal before system dialog
        const grant = await showGrantModal();
        if (!grant) return false;

        if (Platform.Version >= 31) {
          const permissions = [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ];
          const result = await PermissionsAndroid.requestMultiple(permissions);
          return Object.values(result).every(
            (status) => status === PermissionsAndroid.RESULTS.GRANTED
          );
        } else if (Platform.Version >= 23) {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          return result === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true;
      } catch (err) {
        return false;
      }
    }
    return true;
  }

  // Load saved objects and setup status on initial load
  useEffect(() => {
    (async () => {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsedObjects = JSON.parse(data);
        setObjects(parsedObjects);

        // If we already have 3 objects, setup is done
        if (parsedObjects.length === 3) {
          setSetupDone(true);
        }
      }

      const done = await AsyncStorage.getItem(SETUP_DONE_KEY);
      if (done) {
        setSetupDone(true);
      }
    })();
  }, []);

  // Request permissions after completing setup with 3 objects
  useEffect(() => {
    const requestPermissionsAfterSetup = async () => {
      if (objects.length === 3 && !setupDone) {
        // Request permissions
        const permsGranted = await requestBlePermissionsCustom();
        if (permsGranted) {
          await actuallyRequestPermissions();
        }

        // Mark setup as done
        await AsyncStorage.setItem(SETUP_DONE_KEY, "true");
        setSetupDone(true);
      }
    };

    requestPermissionsAfterSetup();
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
      const permsGranted = await requestBlePermissionsCustom();
      if (!permsGranted) return;
      const perms = await actuallyRequestPermissions();
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

  // always reset all refs and their values after adding an object
  const resetForm = () => {
    setErrors({});
    setName("");
    setDescription("");
    setSelectedTag(null);
    setPassword("");
    setConfirm("");
    setPasswordVisible(false);
    setConfirmPasswordVisible(false);
    setTimeout(() => {
      nameRef.current?.focus();
    }, 100);
  };

  // Handle showing the form when the user clicks "Add Object"
  const handleShowForm = () => {
    setShowForm(true);
    resetForm();
  };

  // Setup process screen (adding objects)
  if (!setupDone) {
    const availableTags = TAGS.filter(
      (tag) => !objects.find((obj) => obj.tag === tag.value)
    );

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

    const onConfirm = async () => {
      const err = validate();
      setErrors(err);
      if (Object.keys(err).length > 0) return;

      // Create a new object with a placeholder deviceId (we'll handle real BLE later)
      const obj: ObjectType = {
        name: name.trim(),
        description: description.trim(),
        tag: selectedTag!,
        password,
        deviceId: `placeholder-${Date.now()}`, // Placeholder deviceId
      };

      const updated = [...objects, obj];
      setObjects(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      // Show success modal
      setSuccessModalVisible(true);
    };

    const handleCloseSuccessModal = () => {
      setSuccessModalVisible(false);

      // Reset form for next object
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
                {/* --- Fixed DropDownPicker --- */}
                <View style={{ marginBottom: 10, zIndex: 10 }}>
                  <DropDownPicker
                    open={tagPickerOpen}
                    setOpen={setTagPickerOpen}
                    value={selectedTag}
                    setValue={setSelectedTag}
                    items={availableTags}
                    setItems={setTagPickerItems}
                    placeholder="Select tag..."
                    style={{
                      backgroundColor: "#fff",
                      borderColor: errors.tag ? "red" : "#ddd",
                    }}
                    dropDownContainerStyle={{
                      backgroundColor: "#fff",
                      borderColor: errors.tag ? "red" : "#ddd",
                    }}
                    textStyle={{
                      color: "#000",
                    }}
                    placeholderStyle={{
                      color: "#888",
                    }}
                    listItemLabelStyle={{
                      color: "#000",
                    }}
                    disabled={availableTags.length === 0}
                  />
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
                  style={styles.confirmButton}
                  onPress={onConfirm}
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

        {/* --- Success Modal --- */}
        <Modal
          visible={successModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCloseSuccessModal}
        >
          <View style={styles.modalBg}>
            <View style={styles.successModalContent}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark" size={28} color="#fff" />
              </View>
              <Text style={styles.successModalTitle}>Added Successfully</Text>
              <Text style={styles.successModalText}>
                You may now be able to perform search actions on this specific
                object you've added.
              </Text>
              <TouchableOpacity
                style={styles.successModalButton}
                onPress={handleCloseSuccessModal}
              >
                <Text style={styles.successModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* --- Custom permission modals --- */}
        <Modal
          visible={permissionModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setPermissionModalVisible(false);
            if (pendingPermissionResolve) {
              pendingPermissionResolve(false);
              setPendingPermissionResolve(null);
            }
          }}
        >
          <View style={styles.modalBg}>
            <View style={styles.customModalWhite}>
              <Text style={styles.customModalTitle}>Permissions Required</Text>
              <Text style={styles.customModalText}>
                This app needs Bluetooth and Location permissions to scan for
                BLE tags. Proceed?
              </Text>
              <View style={styles.customModalActions}>
                <TouchableOpacity
                  style={[
                    styles.customModalBtn,
                    { backgroundColor: "#fff", borderColor: "#247eff" },
                  ]}
                  onPress={() => {
                    setPermissionModalVisible(false);
                    if (pendingPermissionResolve) {
                      pendingPermissionResolve(false);
                      setPendingPermissionResolve(null);
                    }
                  }}
                >
                  <Text style={{ color: "#247eff", fontWeight: "bold" }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.customModalBtn,
                    { backgroundColor: "#247eff" },
                  ]}
                  onPress={() => {
                    setPermissionModalVisible(false);
                    if (pendingPermissionResolve) {
                      pendingPermissionResolve(true);
                      setPendingPermissionResolve(null);
                    }
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>
                    Continue
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* --- Custom grant modal --- */}
        <Modal
          visible={grantModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setGrantModalVisible(false);
            if (pendingGrantResolve) {
              pendingGrantResolve(false);
              setPendingGrantResolve(null);
            }
          }}
        >
          <View style={styles.modalBg}>
            <View style={styles.customModalWhite}>
              <Text style={styles.customModalTitle}>Grant Permissions</Text>
              <Text style={styles.customModalText}>
                The system will now ask for Bluetooth and Location permissions.
                Please allow these for correct operation.
              </Text>
              <View style={styles.customModalActions}>
                <TouchableOpacity
                  style={[
                    styles.customModalBtn,
                    { backgroundColor: "#fff", borderColor: "#247eff" },
                  ]}
                  onPress={() => {
                    setGrantModalVisible(false);
                    if (pendingGrantResolve) {
                      pendingGrantResolve(false);
                      setPendingGrantResolve(null);
                    }
                  }}
                >
                  <Text style={{ color: "#247eff", fontWeight: "bold" }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.customModalBtn,
                    { backgroundColor: "#247eff" },
                  ]}
                  onPress={() => {
                    setGrantModalVisible(false);
                    if (pendingGrantResolve) {
                      pendingGrantResolve(true);
                      setPendingGrantResolve(null);
                    }
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>
                    Grant
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Main objects list screen (when setup is done)
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
                    {obj.deviceId && !obj.deviceId.startsWith("placeholder")
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

      {/* --- Permission modals for main screen --- */}
      <Modal
        visible={permissionModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setPermissionModalVisible(false);
          if (pendingPermissionResolve) {
            pendingPermissionResolve(false);
            setPendingPermissionResolve(null);
          }
        }}
      >
        <View style={styles.modalBg}>
          <View style={styles.customModalWhite}>
            <Text style={styles.customModalTitle}>Permissions Required</Text>
            <Text style={styles.customModalText}>
              This app needs Bluetooth and Location permissions to scan for BLE
              tags. Proceed?
            </Text>
            <View style={styles.customModalActions}>
              <TouchableOpacity
                style={[
                  styles.customModalBtn,
                  { backgroundColor: "#fff", borderColor: "#247eff" },
                ]}
                onPress={() => {
                  setPermissionModalVisible(false);
                  if (pendingPermissionResolve) {
                    pendingPermissionResolve(false);
                    setPendingPermissionResolve(null);
                  }
                }}
              >
                <Text style={{ color: "#247eff", fontWeight: "bold" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.customModalBtn, { backgroundColor: "#247eff" }]}
                onPress={() => {
                  setPermissionModalVisible(false);
                  if (pendingPermissionResolve) {
                    pendingPermissionResolve(true);
                    setPendingPermissionResolve(null);
                  }
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>
                  Continue
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={grantModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setGrantModalVisible(false);
          if (pendingGrantResolve) {
            pendingGrantResolve(false);
            setPendingGrantResolve(null);
          }
        }}
      >
        <View style={styles.modalBg}>
          <View style={styles.customModalWhite}>
            <Text style={styles.customModalTitle}>Grant Permissions</Text>
            <Text style={styles.customModalText}>
              The system will now ask for Bluetooth and Location permissions.
              Please allow these for correct operation.
            </Text>
            <View style={styles.customModalActions}>
              <TouchableOpacity
                style={[
                  styles.customModalBtn,
                  { backgroundColor: "#fff", borderColor: "#247eff" },
                ]}
                onPress={() => {
                  setGrantModalVisible(false);
                  if (pendingGrantResolve) {
                    pendingGrantResolve(false);
                    setPendingGrantResolve(null);
                  }
                }}
              >
                <Text style={{ color: "#247eff", fontWeight: "bold" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.customModalBtn, { backgroundColor: "#247eff" }]}
                onPress={() => {
                  setGrantModalVisible(false);
                  if (pendingGrantResolve) {
                    pendingGrantResolve(true);
                    setPendingGrantResolve(null);
                  }
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>Grant</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  customModalWhite: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: 320,
    alignItems: "center",
    elevation: 6,
  },
  customModalTitle: {
    fontWeight: "bold",
    fontSize: 20,
    color: "#247eff",
    marginBottom: 8,
    textAlign: "center",
  },
  customModalText: {
    color: "#000",
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  customModalActions: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    marginTop: 8,
  },
  customModalBtn: {
    flex: 1,
    borderRadius: 8,
    marginHorizontal: 6,
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderWidth: 1,
    borderColor: "#247eff",
    alignItems: "center",
  },
  // Success modal styles
  successModalContent: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 24,
    width: 300,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  successIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#247eff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  successModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#247eff",
    marginBottom: 12,
  },
  successModalText: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  successModalButton: {
    backgroundColor: "#247eff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: "100%",
  },
  successModalButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    textAlign: "center",
  },
});
