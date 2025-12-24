import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../services/supabase";
import { RootStackParamList } from "../types";

type CreateHabitScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "CreateHabit"
>;

const HABIT_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
];

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

const CreateHabitScreen: React.FC = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(HABIT_COLORS[0]);
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">(
    "daily"
  );
  const [isPublic, setIsPublic] = useState(true);
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [duration, setDuration] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const { user } = useAuth();
  const navigation = useNavigation<CreateHabitScreenNavigationProp>();

  const handleCreateHabit = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a habit title");
      return;
    }

    if (!user) {
      Alert.alert("Error", "You must be logged in to create habits");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("habits").insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        color: selectedColor,
        frequency: frequency,
        is_public: isPublic,
        start_time:
          startHour !== null && startMinute !== null
            ? `${startHour.toString().padStart(2, "0")}:${startMinute
                .toString()
                .padStart(2, "0")}`
            : null,
        duration: duration.trim() ? parseInt(duration.trim()) : null,
      });

      if (error) throw error;

      Alert.alert("Success", "Habit created successfully!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error("Error creating habit:", error);
      Alert.alert("Error", "Failed to create habit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Habit</Text>
        <View style={styles.placeholder} />
      </View>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Habit Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Morning Exercise"
                value={title}
                onChangeText={setTitle}
                maxLength={50}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add a description for your habit..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Color</Text>
              <View style={styles.colorGrid}>
                {HABIT_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.selectedColor,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  >
                    {selectedColor === color && (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Frequency</Text>
              <View style={styles.frequencyGrid}>
                {FREQUENCIES.map((freq) => (
                  <TouchableOpacity
                    key={freq.value}
                    style={[
                      styles.frequencyOption,
                      frequency === freq.value && styles.selectedFrequency,
                    ]}
                    onPress={() => setFrequency(freq.value)}
                  >
                    <Text
                      style={[
                        styles.frequencyText,
                        frequency === freq.value &&
                          styles.selectedFrequencyText,
                      ]}
                    >
                      {freq.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Scheduling (Optional)</Text>
              <Text style={styles.schedulingDescription}>
                Set a specific time and duration for this habit
              </Text>
              <View style={styles.schedulingRow}>
                <View style={styles.timeInputContainer}>
                  <Text style={styles.timeLabel}>Start Time</Text>
                  <TouchableOpacity
                    style={styles.timeInput}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Text style={styles.timeInputText}>
                      {`${startHour.toString().padStart(2, "0")}:${startMinute
                        .toString()
                        .padStart(2, "0")}`}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.durationInputContainer}>
                  <Text style={styles.timeLabel}>Duration (min)</Text>
                  <TextInput
                    style={styles.timeInput}
                    placeholder="30"
                    value={duration}
                    onChangeText={setDuration}
                    maxLength={3}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setIsPublic(!isPublic)}
              >
                <View style={styles.toggleInfo}>
                  <Text style={styles.label}>Public Habit</Text>
                  <Text style={styles.toggleDescription}>
                    Allow others to see your progress in the community feed
                  </Text>
                </View>
                <View style={[styles.toggle, isPublic && styles.toggleActive]}>
                  {isPublic && <View style={styles.toggleIndicator} />}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.createButton,
              loading && styles.createButtonDisabled,
            ]}
            onPress={handleCreateHabit}
            disabled={loading}
          >
            <Text style={styles.createButtonText}>
              {loading ? "Creating..." : "Create Habit"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Text style={styles.modalCancelButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Time</Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Text style={styles.modalDoneButton}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pickerContainer}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Hour</Text>
                <Picker
                  selectedValue={startHour}
                  onValueChange={setStartHour}
                  style={styles.picker}
                  itemStyle={{ color: "#333", fontSize: 18 }}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <Picker.Item
                      key={i}
                      label={i.toString().padStart(2, "0")}
                      value={i}
                    />
                  ))}
                </Picker>
              </View>

              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Minute</Text>
                <Picker
                  selectedValue={startMinute}
                  onValueChange={setStartMinute}
                  style={styles.picker}
                  itemStyle={{ color: "#333", fontSize: 18 }}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <Picker.Item
                      key={i * 5}
                      label={(i * 5).toString().padStart(2, "0")}
                      value={i * 5}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedColor: {
    borderWidth: 3,
    borderColor: "#333",
  },
  frequencyGrid: {
    flexDirection: "row",
    gap: 12,
  },
  frequencyOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  selectedFrequency: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  frequencyText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  selectedFrequencyText: {
    color: "#fff",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleInfo: {
    flex: 1,
  },
  toggleDescription: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#ddd",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: "#007AFF",
    alignItems: "flex-end",
  },
  toggleIndicator: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#fff",
  },
  createButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
  },
  createButtonDisabled: {
    backgroundColor: "#ccc",
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  schedulingDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  schedulingRow: {
    flexDirection: "row",
    gap: 12,
  },
  timeInputContainer: {
    flex: 1,
  },
  durationInputContainer: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 6,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  timeInputText: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalCancelButton: {
    fontSize: 16,
    color: "#007AFF",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  modalDoneButton: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
  pickerContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
  },
  pickerColumn: {
    flex: 1,
    alignItems: "center",
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 10,
  },
  picker: {
    width: "100%",
    height: 200,
    color: "#333",
  },
});

export default CreateHabitScreen;
