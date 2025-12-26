import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useAuth } from "../contexts/AuthContext";
import { useHabits } from "../contexts/HabitContext";
import { supabase } from "../services/supabase";
import { RootStackParamList } from "../types";

type CreateHabitScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "CreateHabit"
>;

const HABIT_COLORS = [
  "#FF6B6B", // Warm Red
  "#FF9F43", // Deep Orange
  "#FDCB6E", // Mustard Yellow
  "#55EFC4", // Mint Green
  "#00CEC9", // Robin's Egg Blue
  "#0984E3", // Electron Blue
  "#6C5CE7", // Exquisite Purple
  "#A29BFE", // Shy Moment Lavender
  "#FD79A8", // Pico Pink
  "#E84393", // Prunus Avium Pink
  "#636E72", // American River Grey
  "#2D3436", // Dracula Orchid (Dark Grey)
];

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

const hexToRgba = (hex: string, opacity: number) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(
        result[3],
        16
      )}, ${opacity})`
    : `rgba(0, 0, 0, ${opacity})`;
};

const CreateHabitScreen: React.FC = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(HABIT_COLORS[0]);
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">(
    "daily"
  );
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  const { user } = useAuth();
  const { addHabit } = useHabits();
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
      const newHabit = {
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        color: selectedColor,
        frequency: frequency,
        is_public: isPublic,
        start_time: null,
        duration: null,
      };

      const { data, error } = await supabase
        .from("habits")
        .insert(newHabit)
        .select()
        .single();

      if (error) throw error;

      // Update local state immediately via context
      addHabit(data);

      // Navigate back immediately for "instant" feel
      navigation.goBack();
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
                      selectedColor === color && styles.selectedColor,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  >
                    {/* Deep Depth Layer */}
                    <LinearGradient
                      colors={["#ffffff", "#e8e8e8"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
                    />

                    {/* Strong Color Gradient */}
                    <LinearGradient
                      colors={[hexToRgba(color, 0.08), hexToRgba(color, 0.25)]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
                    />

                    {/* Texture/Noise Simulation */}
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          opacity: 0.03,
                          backgroundColor: "#000",
                          borderRadius: 24,
                        },
                      ]}
                    />

                    {/* Top Highlight */}
                    <LinearGradient
                      colors={[
                        "rgba(255,255,255,0.95)",
                        "rgba(255,255,255,0.0)",
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0.8, y: 0.6 }}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "60%",
                        borderRadius: 24,
                        opacity: 0.6,
                      }}
                    />

                    {/* Bottom-Right Shadow/Rim */}
                    <LinearGradient
                      colors={["transparent", hexToRgba(color, 0.2)]}
                      start={{ x: 0.5, y: 0.5 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        StyleSheet.absoluteFill,
                        { borderRadius: 24, opacity: 0.8 },
                      ]}
                    />

                    {selectedColor === color && (
                      <View style={styles.selectionBorder} />
                    )}

                    {selectedColor === color && (
                      <Ionicons name="checkmark" size={24} color="#333" />
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
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.label}>Public Habit</Text>
                  <Text style={styles.toggleDescription}>
                    Allow others to see your progress in the community feed
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, isPublic && styles.toggleActive]}
                  onPress={() => setIsPublic(!isPublic)}
                >
                  <View style={styles.toggleIndicator} />
                </TouchableOpacity>
              </View>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: "#fff",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  placeholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1a1a1a",
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
    textTransform: "none",
    letterSpacing: 0,
  },
  input: {
    backgroundColor: "#F7F7F7",
    borderRadius: 16,
    padding: 20,
    fontSize: 17,
    color: "#333",
    fontWeight: "500",
  },
  textArea: {
    height: 120,
    textAlignVertical: "top",
    paddingTop: 20,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "flex-start",
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  selectedColor: {
    // Removed scale transform to prevent jagged edges
  },
  selectionBorder: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "#1a1a1a",
    backgroundColor: "transparent",
    borderCurve: "continuous",
  },
  frequencyGrid: {
    flexDirection: "row",
    gap: 12,
  },
  frequencyOption: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedFrequency: {
    backgroundColor: "#1a1a1a",
    borderColor: "#1a1a1a",
  },
  frequencyText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#666",
  },
  selectedFrequencyText: {
    color: "#fff",
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleDescription: {
    fontSize: 13,
    color: "#999",
    marginTop: 4,
    lineHeight: 18,
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 20,
    backgroundColor: "#eee",
    justifyContent: "center",
    paddingHorizontal: 2,
    alignItems: "flex-start",
  },
  toggleActive: {
    backgroundColor: "#1a1a1a",
    alignItems: "flex-end",
  },
  toggleIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  createButton: {
    borderRadius: 16,
    marginTop: 32,
    marginBottom: 40,
    backgroundColor: "#1a1a1a",
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});

export default CreateHabitScreen;
